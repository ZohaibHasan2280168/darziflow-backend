import User from '../models/User.js';
import Order from '../models/Order.js';
import { logAction } from "../utils/auditLogger.js";
import asyncHandler from "express-async-handler";
import { sendNotificationToRoles, createAndSendNotification } from "../services/notificationService.js";
import OrderHistory from '../models/OrderHistory.js';
import OrderRequest from '../models/OrderRequest.js';

// Get all client orders

export const getAllOrders = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    const orders = await Order.find({ clientId: userId });

    const totalOrders = orders.length;
    const activeOrders = orders.filter(order => order.overallStatus === 'IN_PROGRESS').length;
    const completedOrders = orders.filter(order => order.overallStatus === 'COMPLETED').length;

    res.status(200).json({ totalOrders, activeOrders, completedOrders, orders });
});

export const getOrderProgress = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { orderId } = req.params;
    let totalCheckpoints = 0;
    let completedCheckpoints = 0; 


    if(!orderId) return res.status(400).json({ message: "Order ID is required" });

    const order = await Order.findOne({ _id: orderId});

    if(!order) return res.status(404).json({ message: "Order not found" });

    order.workflow.forEach(dept => {
        dept.operations.forEach(operation => {
            operation.checkpoints.forEach(checkpoint => {
                totalCheckpoints++;
                if (
                    checkpoint.status === "COMPLETED" || checkpoint.status === "QC_APPROVED"
                ) {
                    completedCheckpoints++;
                }
                });
            });
            });

            const progress =
  totalCheckpoints === 0
    ? 0
    : Math.round((completedCheckpoints / totalCheckpoints) * 100);

    res.status(200).json({
  success: true,
  totalCheckpoints,
  completedCheckpoints,
  progress
});
});

export const getRecentHistory = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const activities = await OrderHistory.find({ clientId: userId })
        .sort({ createdAt: -1 })
        .limit(10);

        
    res.status(200).json({ activities });
});

export const getFullOrderTimeline = asyncHandler(async (req, res) => {
    const { id } = req.params; 

    let orderIdToSearch = id;
    let requestIdToSearch = id;
    
    const order = await Order.findById(id);
    if (order && order.requestId) {
        requestIdToSearch = order.requestId;
    } else {
        const orderReq = await OrderRequest.findById(id);
        if (orderReq && orderReq.finalOrderId) {
            orderIdToSearch = orderReq.finalOrderId;
        }
    }

    const timeline = await OrderHistory.find({
        $or: [
            { orderId: orderIdToSearch },
            { requestId: requestIdToSearch }
        ],
        clientId: req.user.id // Ensure it belongs to this client
    })
    .sort({ createdAt: -1 })
    .select('displayTitle displayDescription action comment createdAt');

    res.status(200).json({ success: true, timeline });
});

export const getCompletedOrders = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const orders = await Order.find({ clientId: userId, overallStatus: 'COMPLETED' });

    res.status(200).json({ orders });
});


// Approve a department
export const approveDepartment = asyncHandler(async (req, res) => {
    const { orderId, deptId } = req.params;
    const userId = req.user.id;

    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }

    // Verify ownership
    if (order.clientId && order.clientId.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Access denied. You are not the client for this order." });
    }

    const workflowIndex = order.workflow.findIndex(
        dept => dept._id.toString() === deptId || dept.departmentId.toString() === deptId
    );

    if (workflowIndex === -1) {
        return res.status(404).json({ message: "Department not found in this order's workflow." });
    }

    const department = order.workflow[workflowIndex];

    if (department.status !== "CLIENT_APPROVAL_PENDING") {
        return res.status(400).json({ message: "Department is not pending client approval." });
    }

    // Transition department status to COMPLETED
    order.set(`workflow.${workflowIndex}.status`, "COMPLETED");

    // Log action in OrderHistory
    await OrderHistory.create({
        qcMemberId: order.qcMember || userId,
        clientId: userId,
        orderId: order._id,
        orderName: order.name,
        departmentName: department.departmentName,
        action: "CLIENT_DEPT_APPROVE",
        displayTitle: "Department Approved",
        displayDescription: `Department "${department.departmentName}" has been approved by the Client.`,
        comment: "Department approved by Client."
    });

    // Check if there is a subsequent department in the sequence
    const nextWorkflowIndex = workflowIndex + 1;
    let isWorkflowFinished = true;

    if (nextWorkflowIndex < order.workflow.length) {
        isWorkflowFinished = false;
        
        // Transition next department status to IN_PROGRESS
        order.set(`workflow.${nextWorkflowIndex}.status`, "IN_PROGRESS");
        
        // Set first operation of next department to IN_PROGRESS
        if (order.workflow[nextWorkflowIndex].operations.length > 0) {
            order.set(`workflow.${nextWorkflowIndex}.operations.0.status`, "IN_PROGRESS");
        }

        // Notify next department head and admins
        const nextDept = order.workflow[nextWorkflowIndex];
        await sendNotificationToRoles({
            roles: ["ADMIN", "DEPARTMENT_HEAD"],
            departmentId: nextDept.departmentId,
            senderId: userId,
            type: "WORKFLOW_START",
            title: `Workflow Started in ${nextDept.departmentName}`,
            body: `Workflow stage "${nextDept.departmentName}" has started for Order "${order.name}".`,
            data: { orderId: order._id.toString(), screen: "/order-details" }
        });
    } else {
        // No more departments, order is completely complete!
        order.overallStatus = "COMPLETED";

        // Log system order completion in OrderHistory
        await OrderHistory.create({
            clientId: userId,
            orderId: order._id,
            orderName: order.name,
            action: "ORDER_COMPLETED",
            displayTitle: "Order Completed",
            displayDescription: `Order "${order.name}" has been completed successfully.`,
            comment: `Order "${order.name}" is completed.`
        });

        // Notify client and admins
        await createAndSendNotification({
            recipientId: userId,
            type: "ORDER_COMPLETE",
            title: "Order Completed!",
            body: `Congratulations! Your order "${order.name}" has been completed successfully.`,
            data: { orderId: order._id.toString(), screen: "/client-order-view" }
        });

        await sendNotificationToRoles({
            roles: ["ADMIN"],
            senderId: userId,
            type: "ORDER_COMPLETE",
            title: "Order Completed",
            body: `Order "${order.name}" has been completed successfully.`,
            data: { orderId: order._id.toString(), screen: "/order-details" }
        });
    }

    await order.save();

    res.status(200).json({
        success: true,
        message: isWorkflowFinished
            ? "Department approved. Order is fully completed!"
            : `Department approved. Transitioned to next department "${order.workflow[nextWorkflowIndex].departmentName}".`,
        isWorkflowFinished,
        order
    });
});

// Reject an entire department's work
export const rejectDepartment = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { comment, operationId, checkpointId, departmentId } = req.body;
    const userId = req.user.id;

    if (!comment || !comment.trim()) {
        return res.status(400).json({ message: "Please provide a rejection reason." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }

    if (order.clientId && order.clientId.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Access denied. You are not the client for this order." });
    }

    let workflowIndex = -1;

    if (departmentId) {
        workflowIndex = order.workflow.findIndex(
            dept => dept._id.toString() === departmentId || dept.departmentId.toString() === departmentId
        );
    } else if (operationId) {
        workflowIndex = order.workflow.findIndex(
            dept => dept.operations.some(op => op._id.toString() === operationId)
        );
    }

    if (workflowIndex === -1) {
        workflowIndex = order.workflow.findIndex(
            dept => dept.status === "CLIENT_APPROVAL_PENDING" || dept.status === "IN_PROGRESS"
        );
    }

    if (workflowIndex === -1) {
        return res.status(400).json({ message: "No active department found to reject." });
    }

    const department = order.workflow[workflowIndex];

    // Set department status to CLIENT_REJECTED
    order.set(`workflow.${workflowIndex}.status`, "CLIENT_REJECTED");

    // Revert operations and checkpoints in this department
    department.operations.forEach((op, opIdx) => {
        // If an operationId is specified, only revert that operation, else revert all
        if (!operationId || op._id.toString() === operationId) {
            order.set(`workflow.${workflowIndex}.operations.${opIdx}.status`, "IN_PROGRESS");
        }
        
        op.checkpoints.forEach((cp, cpIdx) => {
            // Only set to QC_REJECTED if no specific checkpointId was provided, 
            // or if this is the specific checkpoint being rejected.
            if (!checkpointId || cp._id.toString() === checkpointId) {
                order.set(`workflow.${workflowIndex}.operations.${opIdx}.checkpoints.${cpIdx}.status`, "QC_REJECTED");
            }
        });
    });

    let operationName = "";
    let checkpointName = "";

    if (operationId) {
        const op = department.operations.find(o => o._id.toString() === operationId);
        if (op) {
            operationName = op.name;
            if (checkpointId) {
                const cp = op.checkpoints.find(c => c._id.toString() === checkpointId);
                if (cp) {
                    checkpointName = cp.name;
                }
            }
        }
    }

    let descriptionSuffix = "";
    if (operationName && checkpointName) {
        descriptionSuffix = ` (Context: Operation "${operationName}", Checkpoint "${checkpointName}")`;
    } else if (operationName) {
        descriptionSuffix = ` (Context: Operation "${operationName}")`;
    }

    // Log action in OrderHistory
    await OrderHistory.create({
        qcMemberId: order.qcMember || userId,
        clientId: userId,
        orderId: order._id,
        orderName: order.name,
        departmentName: department.departmentName,
        ...(operationName && { operationName }),
        ...(checkpointName && { checkpointName }),
        action: "CLIENT_REJECT",
        displayTitle: "Department Rejected",
        displayDescription: `Department "${department.departmentName}" has been rejected by the Client.${descriptionSuffix} Reason: ${comment.trim()}`,
        comment: comment.trim()
    });

    await order.save();

    // Notify Admins and Department Head
    await sendNotificationToRoles({
        roles: ["ADMIN", "DEPARTMENT_HEAD"],
        departmentId: department.departmentId,
        senderId: userId,
        type: "DEPT_REJECT",
        title: "Department Rejected by Client",
        body: `Client rejected department "${department.departmentName}"${operationName ? ` at operation "${operationName}"` : ""}. Reason: ${comment.trim().substring(0, 30)}...`,
        data: { orderId: order._id.toString(), screen: "/order-details" }
    });

    res.status(200).json({
        success: true,
        message: "Department rejected successfully.",
        order
    });
});

