import Order from '../../models/Order.js';
import User from '../../models/User.js';
import asyncHandler from 'express-async-handler';
import {logAction} from "../../utils/auditLogger.js";
import { orderSchema,updateOrderSchema } from '../../validations/orderValidation.js';
import { createAndSendNotification, sendNotificationToRoles } from "../../services/notificationService.js";
import Department from '../../models/Department.js';
import { findOrCreateClient } from '../../services/userService.js';
import mongoose from 'mongoose'; 
import OrderRequest from '../../models/OrderRequest.js';
import OrderHistory from '../../models/OrderHistory.js';
import { v4 as uuidv4 } from 'uuid';

export const createOrder = asyncHandler(async (req, res) => {

    // Joi validation for req body
    const { error, value } = orderSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    // extract valdiated values from joi
    const { 
        requiredDocTypes = [], 
        amount, 
        currency, 
        departmentSequenceIds, 
        name, 
        type,
        dueDate, 
        description, 
        clientName, 
        clientEmail, 
        clientId,
        qcMemberId,
        sourceRequestId,
        approvedBlueprints = []
    } = value;

    // all pre reqs are pending
    const prerequisiteDocs = requiredDocTypes.map(docType => ({
        docType,
        status: 'PENDING',
        fileUrl: '',
    }));

    // Client Profile Creation
    let client;
    try {
        client = await findOrCreateClient({
            name: clientName,
            email: clientEmail,
            reqUserId: req.user._id,
            clientId: clientId
        });
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }

    // Duplicate Order Check
    const existingOrder = await Order.findOne({
        clientId: client._id,
        name,
        type,
        dueDate,
        amount,
    });

    if (existingOrder) {
        return res.status(409).json({
            message: "An identical order already exists for this client with the same name, type, and due date.",
        });
    }

    // if there are prerequisite docs, order starts in DOCS_PENDING, otherwise status is READY_TO_START
    const initialStatus = prerequisiteDocs.length > 0 ? 'DOCS_PENDING' : 'READY_TO_START';

    // Build the workflow timeline from Departments
    const selectedDepartments = await Department.find({ '_id': { $in: departmentSequenceIds } });
    
    // Maintain the sequence order from departmentSequenceIds
    const initialWorkflow = departmentSequenceIds.map(deptId => {
        const dept = selectedDepartments.find(d => d._id.toString() === deptId.toString());
        if (!dept) return null;

        return {
            departmentId: dept._id,
            departmentName: dept.name,
            status: "PENDING",
            operations: dept.operations.map(op => ({
                name: op.name,
                description: op.description,
                status: "PENDING",
                checkpoints: op.checkpoints.map(cp => ({
                    name: cp.name,
                    description: cp.description,
                    allowedSubmissionTypes: cp.allowedSubmissionTypes,
                    minRequiredUploads: cp.minRequiredUploads,
                    status: "PENDING"
                }))
            }))
        };
    }).filter(w => w !== null);

    const order = await Order.create({
        uniqueId: uuidv4(),
        name,
        type,
        description,
        amount,
        currency, 
        dueDate,
        clientName: client.name,
        clientEmail: client.email,
        clientId: client._id,
        qcMember: qcMemberId || null,
        requiredDocuments: prerequisiteDocs,
        departmentSequence: departmentSequenceIds,
        workflow: initialWorkflow,
        requestId: sourceRequestId || null,
        approvedBlueprints,
        createdBy: req.user._id,
        overallStatus: initialStatus
    });

    if (sourceRequestId) {
        const request = await OrderRequest.findByIdAndUpdate(sourceRequestId, {
            status: "CONVERTED",
            finalOrderId: order._id
        });

        // Notify Client that their request is now an order
        await createAndSendNotification({
            recipientId: request.clientId,
            senderId: req.user._id,
            type: "REQUEST_CONVERTED",
            title: "Request Approved!",
            body: `Your request "${order.name}" has been converted to an order.`,
            data: {
                requestId: sourceRequestId.toString(),
                orderId: order._id.toString(),
                screen: "/order-details"
            }
        });
    }
    
    if (initialStatus === 'READY_TO_START' && departmentSequenceIds.length > 0) {
        await sendNotificationToRoles({
            roles: ["ADMIN", "DEPARTMENT_HEAD"],
            departmentId: departmentSequenceIds[0],
            senderId: req.user._id,
            type: "ORDER_CREATE",
            title: "New Order Assigned",
            body: `Order "${order.name}" is ready for production.`,
            data: {
                orderId: order._id.toString(),
                deptId: departmentSequenceIds[0].toString(),
                screen: "/order-details"
            }
        });
    }

    await OrderHistory.create({
        clientId: client._id,
        requestId: sourceRequestId || null,
        orderId: order._id,
        orderName: order.name,
        action: "ORDER_PLACED",
        displayTitle: "Order Placed",
        displayDescription: `Order "${order.name}" has been placed and is ${initialStatus === 'DOCS_PENDING' ? 'awaiting documents' : 'ready to start'}.`
    });


    res.status(201).json({ success: true, order });
});

export const getOrders = asyncHandler(async (req, res) => {
    const user = req.user;
    let filter = {};

    if (user.role === 'CLIENT') {
        filter = { clientId: user._id };
    } else if (user.role === 'QC_MEMBER') {
        filter = { qcMember: new mongoose.Types.ObjectId(user._id) }; 
    }

    const orders = await Order.find(filter)
        .sort({ createdAt: -1 })
        .populate('clientId', 'name email')
        .populate('qcMember', 'name email');

    res.status(200).json({ success: true, count: orders.length, orders });
});

export const getOrderDetails = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId)
        .populate('clientId', 'name email')
        .populate('qcMember', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    res.status(200).json({ success: true, order });
});

export const updateOrderMetadata = asyncHandler(async (req, res) => {
    const { error, value } = updateOrderSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { orderId } = req.params; 

    const order = await Order.findById(orderId.trim());
    if (!order) {
        return res.status(404).json({ message: `Order not found.` });
    }

    if(order.overallStatus === 'IN_PROGRESS' || order.overallStatus === 'COMPLETED') {
        return res.status(403).json({ message: `Cannot update order metadata when order is ${order.overallStatus}.` });
    }

    const updateData = { ...value };

    if (value.clientId || value.clientEmail || value.clientName) {
        try {
            const client = await findOrCreateClient({
                name: value.clientName || order.clientName,
                email: value.clientEmail || order.clientEmail,
                reqUserId: req.user._id,
                clientId: value.clientId
            });
            updateData.clientId = client._id;
            updateData.clientName = client.name;
            updateData.clientEmail = client.email;
        } catch (err) {
            return res.status(400).json({ message: err.message });
        }
    }

    if (value.qcMemberId) {
        updateData.qcMember = value.qcMemberId;
        delete updateData.qcMemberId;
    }

    if (value.requiredDocTypes) {
        updateData.requiredDocuments = value.requiredDocTypes.map(docType => ({
            docType,
            status: 'PENDING',
            fileUrl: '',
        }));

        if (updateData.requiredDocuments.length > 0) {
            updateData.overallStatus = 'DOCS_PENDING';
        } else if (order.overallStatus === 'DOCS_PENDING') {
            updateData.overallStatus = 'READY_TO_START';
        }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
        orderId.trim(),
        { $set: updateData },
        { new: true, runValidators: true }
    );

    if (updatedOrder.overallStatus === 'READY_TO_START' && updatedOrder.departmentSequence.length > 0) {
        await sendNotificationToRoles({
            roles: ["ADMIN", "DEPARTMENT_HEAD"],
            departmentId: updatedOrder.departmentSequence[0],
            senderId: req.user._id,
            type: "ORDER_UPDATE",
            title: "Order Requirements Updated",
            body: `The requirements for Order "${updatedOrder.name}" have been modified.`,
            data: {
                orderId: updatedOrder._id.toString(),
                screen: "/order-details"
            }
        });
    }

    await logAction(req, {
        action: "ORDER_UPDATE",
        orderId: updatedOrder._id,
        performedBy: req.user._id,
        details: `Updated Order ${updatedOrder.name}. Fields: ${Object.keys(value).join(', ')}`,
        priority: "info"
    });

    res.status(200).json({ success: true, order: updatedOrder });
});

export const deleteOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    // capture identifying info before deletion
    const captured = {
        id: order._id,
        name: order.name,
        firstDept: (order.departmentSequence && order.departmentSequence.length > 0) ? order.departmentSequence[0] : null
    };

    try {
        // remove the order document using model delete (avoids document.remove issues)
        await Order.findByIdAndDelete(captured.id);

        // notify relevant roles that the order was deleted
        await sendNotificationToRoles({
            roles: ["ADMIN", "DEPARTMENT_HEAD"],
            departmentId: captured.firstDept,
            senderId: req.user._id,
            type: "ORDER_DELETE",
            title: "Order Cancelled/Deleted",
            body: `Order "${captured.name}" has been removed from the system.`,
            data: { screen: "/dept-head-dashboard" }
        });

        // log the deletion
        await logAction(req, {
            action: "ORDER_DELETE",
            orderId: captured.id,
            performedBy: req.user._id,
            details: `Deleted Order ${captured.id} ${captured.name}`,
            priority: "info"
        });

        return res.status(200).json({ success: true, message: 'Order deleted successfully.' });
    } catch (err) {
        console.error('Error deleting order:', err);
        return res.status(500).json({ message: 'Failed to delete order: ' + (err.message || 'unknown error') });
    }
});

export const getOrderWorkflow = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const user = req.user;

    const order = await Order.findById(orderId)
        .select('name workflow overallStatus');

    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }

    let responseWorkflow = order.workflow;

    // Dynamic filtering for Department Heads
    if (user.role === 'DEPARTMENT_HEAD') {
        // Use the 'department' field from your User Schema
        if (!user.department) {
            return res.status(403).json({ message: "You are not assigned to any department." });
        }

        responseWorkflow = order.workflow.filter(
            (w) => w.departmentId.toString() === user.department.toString()
        );
    }

    // Sort History for each checkpoint: Newest First
    // We iterate through the filtered workflow to polish the data for the UI
    responseWorkflow = responseWorkflow.map(deptStage => {
        const updatedOperations = deptStage.operations.map(op => {
            const updatedCheckpoints = op.checkpoints.map(cp => {
                if (cp.history && cp.history.length > 0) {
                    // Sort history by 'actedAt' date in descending order
                    cp.history.sort((a, b) => new Date(b.actedAt) - new Date(a.actedAt));
                }
                return cp;
            });
            return { ...op, checkpoints: updatedCheckpoints };
        });
        return { ...deptStage, operations: updatedOperations };
    });

    res.status(200).json({
        success: true,
        orderName: order.name,
        overallStatus: order.overallStatus,
        workflow: responseWorkflow
    });
});

export const assignQCMember = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { qcMemberId } = req.body;

    if (!qcMemberId) {
        return res.status(400).json({ message: "Please provide a QC Member ID." });
    }

    // 1. Verify the user exists and actually holds the QC_MEMBER role
    const qcUser = await User.findById(qcMemberId);
    if (!qcUser || qcUser.role !== 'QC_MEMBER') {
        return res.status(400).json({ message: "Invalid user or user is not a QC Member." });
    }

    // 2. Find the Order
    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }

    const previousQcId = order.qcMember;

    // 3. Update the Order
    order.qcMember = qcMemberId;
    await order.save();

    // 4. Notify the newly assigned QC Member (only if it's actually a new assignment)
    if (previousQcId?.toString() !== qcMemberId.toString()) {
        await createAndSendNotification({
            recipientId: qcMemberId,
            senderId: req.user._id, 
            type: "ORDER_ASSIGNED",
            title: "New Order Assigned to You",
            body: `You have been assigned as the Quality Control lead for Order "${order.name}".`,
            data: { orderId: order._id.toString(), screen: "/qc-panel" }
        });
        
        // Optional: Notify the old QC that they were removed
        if (previousQcId) {
            await createAndSendNotification({
                recipientId: previousQcId,
                senderId: req.user._id,
                type: "ORDER_UPDATE",
                title: "Order Reassigned",
                body: `You are no longer the assigned QC for Order "${order.name}".`,
                data: { orderId: order._id.toString(), screen: "/qc-panel" }
            });
        }
    }

    res.status(200).json({
        success: true,
        message: "QC Member assigned successfully.",
        qcMember: {
            _id: qcUser._id,
            name: qcUser.name,
            email: qcUser.email
        }
    });
});