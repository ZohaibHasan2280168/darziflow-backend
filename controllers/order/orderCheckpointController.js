import Order from '../../models/Order.js';
import OrderHistory from '../../models/OrderHistory.js';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { deleteByPublicId } from '../../services/cloudinaryService.js'
import { createAndSendNotification, sendNotificationToRoles } from "../../services/notificationService.js";
import User from '../../models/User.js';
import Department from '../../models/Department.js';



// ----------------------- Controllers -------------------------------

export const submitCheckpoint = asyncHandler(async (req, res) => {
    const { orderId, opId, chkId } = req.params;
    const { submissionText, files = [] } = req.body;
    const userId = req.user._id;

    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    const opObjectId = new mongoose.Types.ObjectId(opId);
    const chkObjectId = new mongoose.Types.ObjectId(chkId);

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });

    // Manage Files
    const existingEntry = await Order.findOne(
        { _id: orderObjectId, "workflow.operations._id": opObjectId },
        { "workflow.$": 1 }
    );

    let previousFiles = [];
    let currentDeptId = null;
    let currentDeptName = "";
    let currentOpName = "";
    let currentChkName = "";
    let currentOpIndex = -1;
    let targetDept = null;

    for (const dept of order.workflow) {
        for (let i = 0; i < dept.operations.length; i++) {
            const op = dept.operations[i];
            const chk = op.checkpoints.id ? op.checkpoints.id(chkId) : op.checkpoints.find(c => c._id.toString() === chkId.toString());
            if (chk) {
                targetDept = dept;
                currentDeptId = dept.departmentId;
                currentDeptName = dept.departmentName;
                currentOpName = op.name;
                currentChkName = chk.name;
                previousFiles = chk.submissionFiles || [];
                currentOpIndex = i;
                break;
            }
        }
        if (currentChkName) break;
    }

    if (!currentChkName) {
        console.warn(`[submitCheckpoint] Checkpoint ${chkId} not found in order ${orderId} workflow for history logging.`);
    }

    // Chronological Operation Progression Check
    if (targetDept && currentOpIndex > 0) {
        for (let i = 0; i < currentOpIndex; i++) {
            const prevOp = targetDept.operations[i];
            if (prevOp.status !== 'COMPLETED') {
                return res.status(400).json({
                    message: `Cannot submit checkpoint for '${currentOpName}' because the previous operation '${prevOp.name}' is not completed.`
                });
            }
        }
    }

    for (const file of previousFiles) {
        if (file.publicId) await deleteByPublicId(file.publicId, file.resourceType || "auto");
    }

    const formattedFiles = files.map(file => ({
        url: file.url,
        publicId: file.publicId,
        resourceType: file.resourceType,
        uploadedBy: userId,
        uploadedAt: new Date()
    }));

    await Order.updateOne(
        { _id: orderObjectId, "workflow.operations._id": opObjectId, "workflow.operations.checkpoints._id": chkObjectId },
        {
            $set: {
                "workflow.$[].operations.$[op].checkpoints.$[chk].status": "SUBMITTED",
                "workflow.$[].operations.$[op].checkpoints.$[chk].submissionFiles": formattedFiles,
                ...(submissionText && { "workflow.$[].operations.$[op].checkpoints.$[chk].submissionText": submissionText })
            }
        },
        { arrayFilters: [{ "op._id": opObjectId }, { "chk._id": chkObjectId }] }
    );

    let historyError = null;
    try {
        // Debug logging for IDs
        console.log("OrderHistory.create Attempt:", {
            qcMemberId: userId,
            clientId: order.clientId,
            orderId: order._id,
            action: "SUBMIT"
        });

        await OrderHistory.create({
            qcMemberId: userId,
            clientId: order.clientId,
            orderId: order._id,
            orderName: order.name,
            departmentName: currentDeptName,
            operationName: currentOpName,
            checkpointName: currentChkName,
            action: "SUBMIT",
            displayTitle: "Checkpoint Submitted",
            displayDescription: `Checkpoint "${currentChkName}" submitted in "${currentOpName}".`
        });
        console.log("OrderHistory.create Success!");
    } catch (err) {
        console.error("OrderHistory.create SUBMIT error:", err.message);
        historyError = err.message;
    }

    if (order.qcMember) {
        await createAndSendNotification({
            recipientId: order.qcMember,
            senderId: userId,
            type: "CHK_SUBMIT",
            title: "New Checkpoint Submission",
            body: `Order ${order.name}: A checkpoint is ready for your review.`,
            data: { orderId: orderId, screen: "/qc-panel" }
        });
    }

    await sendNotificationToRoles({
        roles: ["ADMIN", "DEPARTMENT_HEAD"],
        departmentId: currentDeptId,
        senderId: userId,
        type: "CHK_SUBMIT",
        title: "QC Review Pending",
        body: `Order ${order.name}: A checkpoint has been submitted in your department.`,
        data: { orderId: orderId, screen: "/order-details" }
    });

    res.status(200).json({
        success: true,
        checkpointStatus: "SUBMITTED",
        historyCreated: !historyError,
        historyError
    });
});

export const approveCheckpoint = asyncHandler(async (req, res) => {
    const { orderId, opId, chkId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    let deptId = null;
    let deptName = "";
    let opName = "";
    let chkName = "";

    for (const dept of order.workflow) {
        for (const op of dept.operations) {
            const chk = op.checkpoints.id(chkId);
            if (chk) {
                deptId = dept.departmentId;
                deptName = dept.departmentName;
                opName = op.name;
                chkName = chk.name;
                break;
            }
        }
        if (chkName) break;
    }

    if (!chkName) {
        console.warn(`[approveCheckpoint] Checkpoint ${chkId} not found in order ${orderId} for logging.`);
    }

    await Order.updateOne(
        { _id: orderId, 'workflow.operations._id': opId, 'workflow.operations.checkpoints._id': chkId },
        { $set: { 'workflow.$[].operations.$[op].checkpoints.$[chk].status': 'COMPLETED' } },
        { arrayFilters: [{ 'op._id': opId }, { 'chk._id': chkId }] }
    );

    await OrderHistory.create({
        qcMemberId: userId,
        clientId: order.clientId,
        orderId: order._id,
        orderName: order.name,
        departmentName: deptName,
        operationName: opName,
        checkpointName: chkName,
        action: "APPROVE",
        displayTitle: "Checkpoint Approved by QC",
        displayDescription: `QC Approved checkpoint "${chkName}" in "${opName}".`
    });

    await sendNotificationToRoles({
        roles: ["ADMIN", "DEPARTMENT_HEAD"],
        departmentId: deptId,
        senderId: userId,
        type: "CHK_APPROVE",
        title: "Checkpoint Approved",
        body: `QC Approved "${chkName}" in Order ${order.name} for ${deptName}.`,
        data: { orderId: orderId, screen: "/order-details" }
    });

    if (order.clientId) {
        await createAndSendNotification({
            recipientId: order.clientId,
            type: "ORDER_UPDATE",
            title: "Production Update",
            body: `Your order "${order.name}" has passed a checkpoint QC`,
            data: { orderId: orderId, screen: "/client-order-view" }
        });
    }

    res.status(200).json({ success: true, message: 'Checkpoint approved' });
});

export const rejectCheckpoint = asyncHandler(async (req, res) => {
    const { orderId, opId, chkId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    if (!comment?.trim()) return res.status(400).json({ message: 'Please provide a rejection reason.' });

    const order = await Order.findById(orderId);

    let workerId = null;
    let deptName = "";
    let deptId = null;
    let opName = "";
    let chkName = "";

    for (const dept of order.workflow) {
        for (const op of dept.operations) {
            const chk = op.checkpoints.id(chkId);
            if (chk) {
                workerId = chk.submissionFiles?.[0]?.uploadedBy;
                deptName = dept.departmentName;
                deptId = dept.departmentId;
                opName = op.name;
                chkName = chk.name;
                break;
            }
        }
        if (chkName) break;
    }

    if (!chkName) {
        console.warn(`[rejectCheckpoint] Checkpoint ${chkId} not found in order ${orderId} for logging.`);
    }

    await Order.updateOne(
        { _id: orderId, 'workflow.operations._id': opId, 'workflow.operations.checkpoints._id': chkId },
        { $set: { 'workflow.$[].operations.$[op].checkpoints.$[chk].status': 'QC_REJECTED' } },
        { arrayFilters: [{ 'op._id': opId }, { 'chk._id': chkId }] }
    );

    await OrderHistory.create({
        qcMemberId: userId,
        clientId: order.clientId,
        orderId: order._id,
        orderName: order.name,
        departmentName: deptName,
        operationName: opName,
        checkpointName: chkName,
        action: "REJECT",
        displayTitle: "Checkpoint Rejected by QC",
        displayDescription: `QC Rejected checkpoint "${chkName}" in "${opName}".`,
        comment: comment.trim()
    });

    if (workerId) {
        await createAndSendNotification({
            recipientId: workerId,
            senderId: userId,
            type: "CHK_REJECT",
            title: "Checkpoint Rejected",
            body: `QC rejected your submission in ${deptName}. Reason: ${comment.substring(0, 30)}...`,
            data: { orderId: orderId, screen: "/order-workflow" }
        });
    }

    if (deptId) {
        const department = await Department.findById(deptId);
        if (department && department.departmentHead && department.departmentHead.toString() !== workerId?.toString()) {
            await createAndSendNotification({
                recipientId: department.departmentHead,
                senderId: userId,
                type: "CHK_REJECT",
                title: `QC Rejection in ${deptName}`,
                body: `A checkpoint Submission in department was rejected. Reason: ${comment.substring(0, 30)}...`,
                data: { orderId: orderId, screen: "/order-workflow" }
            });
        }
    }

    await sendNotificationToRoles({
        roles: ["ADMIN"],
        senderId: userId,
        type: "CHK_REJECT",
        title: `QC Rejection in ${deptName}`,
        body: `QC rejected a submission in ${deptName} for Order ${order.name}. Reason: ${comment.substring(0, 30)}...`,
        data: { orderId: orderId, screen: "/order-details" }
    });

    res.status(200).json({ success: true, message: 'Checkpoint rejected successfully' });
});

// Client API (called by admin) TODO
export const finalApproveCheckpoint = asyncHandler(async (req, res) => {
    const { orderId, operationId, checkpointId } = req.params;
    const order = await Order.findById(orderId);
    const operationObjectId = new mongoose.Types.ObjectId(operationId);
    const checkpointObjectId = new mongoose.Types.ObjectId(checkpointId);

    if (!order) {
        return res.status(404).json({
            message: 'Checkpoint not found or not QC approved'
        });
    }

    let workflowIndex = -1;
    let operationIndex = -1;
    let checkpointIndex = -1;

    for (let i = 0; i < order.workflow.length; i++) {
        const dept = order.workflow[i];
        for (let j = 0; j < dept.operations.length; j++) {
            const op = dept.operations[j];
            if (op._id.toString() === operationId) {
                operationIndex = j;
                workflowIndex = i;
                for (let k = 0; k < op.checkpoints.length; k++) {
                    if (op.checkpoints[k]._id.toString() === checkpointId) {
                        checkpointIndex = k;
                        break;
                    }
                }
                break;
            }
        }
        if (operationIndex !== -1) break;
    }

    if (workflowIndex === -1 || operationIndex === -1 || checkpointIndex === -1) {
        return res.status(404).json({
            message: 'Checkpoint not found'
        });
    }

    const checkpointPath = `workflow.${workflowIndex}.operations.${operationIndex}.checkpoints.${checkpointIndex}`;

    order.set(`${checkpointPath}.status`, 'COMPLETED');

    // Create History Record
    await OrderHistory.create({
        qcMemberId: req.user._id,
        clientId: order.clientId,
        orderId: order._id,
        orderName: order.name,
        departmentName: order.workflow[workflowIndex].departmentName,
        operationName: order.workflow[workflowIndex].operations[operationIndex].name,
        checkpointName: order.workflow[workflowIndex].operations[operationIndex].checkpoints[checkpointIndex].name,
        action: "FINAL_APPROVE",
        displayTitle: "Checkpoint Final Approved",
        displayDescription: `Checkpoint "${order.workflow[workflowIndex].operations[operationIndex].checkpoints[checkpointIndex].name}" final approved. Pending Client approval.`,
        comment: 'Final approval granted by Admin. Task closed.'
    });

    const operation = order.workflow[workflowIndex].operations[operationIndex];
    const allCheckpointsCompleted = operation.checkpoints.every(cp => cp.status === 'COMPLETED');

    if (allCheckpointsCompleted) {
        order.set(`workflow.${workflowIndex}.operations.${operationIndex}.status`, 'COMPLETED');

        // Check if ALL operations in this department are now complete
        // Re-read after the above set() to get the updated statuses
        const allOpsCompleted = order.workflow[workflowIndex].operations.every(
            (op, idx) => idx === operationIndex ? true : op.status === 'COMPLETED'
        );

        if (allOpsCompleted) {
            // Flag department for client approval — this unlocks approveDepartment()
            order.set(`workflow.${workflowIndex}.status`, 'CLIENT_APPROVAL_PENDING');
        }
    }

    await order.save();

    if (order.clientId) {
        if (allCheckpointsCompleted) {
            await createAndSendNotification({
                recipientId: order.clientId,
                type: "ORDER_UPDATE",
                title: "Operation Approval Required",
                body: `The operation "${operation.name}" under "${order.workflow[workflowIndex].departmentName}" department is complete and requires your approval.`,
                data: { orderId: orderId, screen: "/client-order-view" }
            });
        } else {
            await createAndSendNotification({
                recipientId: order.clientId,
                type: "ORDER_UPDATE",
                title: "Production Update",
                body: `Checkpoint "${operation.checkpoints[checkpointIndex].name}" in operation "${operation.name}" has been completed.`,
                data: { orderId: orderId, screen: "/client-order-view" }
            });
        }
    }

    // Notify Admins and Department Head
    await sendNotificationToRoles({
        roles: ["ADMIN", "DEPARTMENT_HEAD"],
        departmentId: order.workflow[workflowIndex].departmentId,
        senderId: req.user._id,
        type: "ADMIN_FINAL_APPROVE",
        title: "Department Work Closed",
        body: `Admin has granted final approval for the ${order.workflow[workflowIndex].departmentName} stage of Order "${order.name}".`,
        data: { orderId: orderId, screen: "/order-details" }
    });

    res.status(200).json({
        success: true,
        message: 'Checkpoint marked as completed'
    });
});

export const getQcHistory = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;

    const historyLog = await OrderHistory.find({
        qcMemberId: req.user._id,
        action: { $in: ["SUBMIT", "APPROVE", "REJECT", "FINAL_APPROVE"] }
    })
        .sort({ createdAt: -1 })
        .limit(limit);

    res.status(200).json({
        success: true,
        count: historyLog.length,
        data: historyLog
    });
});
