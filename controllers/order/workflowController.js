import Order from '../../models/Order.js';
import asyncHandler from 'express-async-handler';
import {logAction} from "../../utils/auditLogger.js";
import { createAndSendNotification, sendNotificationToRoles } from "../../services/notificationService.js";

const getCurrentDepartmentIndex = (workflow) => workflow.findIndex(d => ['IN_PROGRESS','COMPLETED','CLIENT_REJECTED'].includes(d.status));

export const uploadPrerequisiteDocument = asyncHandler(async (req, res) => {
    const { orderId, docType } = req.params;
    const { url, publicId, resourceType } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!url || !publicId) {
        return res.status(400).json({ message: "Upload metadata missing." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }

    const doc = order.requiredDocuments.find(d => d.docType === docType);
    if (!doc) {
        return res.status(404).json({ message: "Prerequisite type not found." });
    }

    if (doc.filePublicId) {
        await deleteByPublicId(doc.filePublicId, doc.resourceType || "auto");
    }

    doc.status = "UPLOADED";
    doc.fileUrl = url;
    doc.filePublicId = publicId;
    doc.resourceType = resourceType;

    const allUploadedOrApproved = order.requiredDocuments.every(d =>
        ["UPLOADED", "APPROVED"].includes(d.status)
    );

    if (allUploadedOrApproved && order.overallStatus === "DOCS_PENDING") {
        order.overallStatus = "READY_TO_START";
    }

    await order.save();

    if (userRole === 'ADMIN') {
        if (order.clientId) {
            await createAndSendNotification({
                recipientId: order.clientId,
                senderId: userId,
                type: "PREREQ_UPLOAD",
                title: "New Document Uploaded",
                body: `Admin has uploaded the ${docType} for Order: ${order.name}. Please review.`,
                data: {
                    orderId: order._id.toString(),
                    screen: "/client-order-view"
                }
            });
        }
    } else if (userRole === 'CLIENT') {
        await sendNotificationToRoles({
            roles: ["ADMIN"],
            senderId: userId,
            type: "PREREQ_UPLOAD",
            title: "Client Document Uploaded 📥",
            body: `Client has uploaded ${docType} for Order: ${order.name}.`,
            data: {
                orderId: order._id.toString(),
                screen: "/order-details"
            }
        });
    }

    await logAction(req, {
        action: "PREREQ_UPLOAD",
        orderId: order._id,
        performedBy: userId,
        details: `Uploaded prerequisite document ${docType} for Order ${order.name}`,
        priority: "info"
    });

    res.status(200).json({
        success: true,
        message: `${docType} uploaded successfully.`,
        order
    });
});

// APPROVE PREREQUISITE
export const approvePrerequisite = asyncHandler(async (req, res) => {
    const { orderId, docType } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const doc = order.requiredDocuments.find(d => d.docType === docType);
    if (!doc) return res.status(404).json({ message: "Document type not found" });

    doc.status = "APPROVED";
    doc.approvedBy = userId;

    const allApproved = order.requiredDocuments.every(d => d.status === "APPROVED");
    if (allApproved) {
        order.overallStatus = "READY_TO_START";
    }

    await order.save();

    if (order.clientId) {
        let notificationTitle = "Document Approved";
        let notificationBody = `Your document (${docType}) for Order "${order.name}" has been approved.`;

        if (allApproved) {
            notificationTitle = "Order Ready for Production!";
            notificationBody = `All documents for "${order.name}" are approved. Production will begin shortly.`;
        }

        await createAndSendNotification({
            recipientId: order.clientId,
            senderId: userId,
            type: "PREREQ_APPROVE",
            title: notificationTitle,
            body: notificationBody,
            data: {
                orderId: order._id.toString(),
                screen: "/client-order-view"
            }
        });
    }

    // Notify Admins
    await sendNotificationToRoles({
        roles: ["ADMIN"],
        senderId: userId,
        type: "PREREQ_APPROVE",
        title: "Prerequisite Approved",
        body: `Document (${docType}) for Order "${order.name}" has been approved.`,
        data: {
            orderId: order._id.toString(),
            screen: "/order-details"
        }
    });

    await logAction(req, {
        action: "PREREQ_APPROVE",
        orderId: order._id, 
        performedBy: userId,
        details: `Approved prerequisite document ${docType} for Order ${order.name}`,
        priority: "info"
    });

    res.status(200).json({ success: true, message: "Document approved successfully" });
});

// REJECT PREREQUISITE
export const rejectPrerequisite = asyncHandler(async (req, res) => {
    const { orderId, docType } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const doc = order.requiredDocuments.find(d => d.docType === docType);
    if (!doc) return res.status(404).json({ message: "Document type not found" });

    // Cloudinary Cleanup
    if (doc.filePublicId) {
        try {
            await deleteByPublicId(doc.filePublicId, doc.resourceType || "auto");
        } catch (err) {
            console.error("Cloudinary delete failed:", err);
        }
    }

    doc.status = "PENDING";
    doc.fileUrl = ""; 
    doc.filePublicId = "";
    
    if (order.overallStatus === "READY_TO_START") {
        order.overallStatus = "DOCS_PENDING";
    }

    await order.save();

    if (order.clientId) {
        await createAndSendNotification({
            recipientId: order.clientId,
            senderId: userId,
            type: "PREREQ_REJECT",
            title: "Document Rejected",
            body: `Your document (${docType}) for Order "${order.name}" was rejected. Please upload a valid file.`,
            data: {
                orderId: order._id.toString(),
                screen: "/client-order-view"
            }
        });
    }

    // Notify Admins
    await sendNotificationToRoles({
        roles: ["ADMIN"],
        senderId: userId,
        type: "PREREQ_REJECT",
        title: "Prerequisite Rejected",
        body: `Document (${docType}) for Order "${order.name}" was rejected.`,
        data: {
            orderId: order._id.toString(),
            screen: "/order-details"
        }
    });

    await logAction(req, {
        action: "PREREQ_REJECT",
        orderId: order._id,
        performedBy: userId,
        details: `Rejected prerequisite document ${docType} for Order ${order.name}`,
        priority: "info"
    });

    res.status(200).json({ success: true, message: "Document reset. New upload required." });
});

export const startWorkflow = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
   
    if (order.overallStatus !== 'READY_TO_START') {
        return res.status(403).json({ message: 'Order not ready to start.' });
    }

    // workflow[] is fully pre-built by createOrder — activate dept[0] in-place.
    // Do NOT push(); that would duplicate the first department and corrupt the array.
    if (!order.workflow || order.workflow.length === 0) {
        return res.status(500).json({ message: 'Workflow is not initialized for this order. Cannot start.' });
    }

    order.set('workflow.0.status', 'IN_PROGRESS');
    if (order.workflow[0].operations?.length > 0) {
        order.set('workflow.0.operations.0.status', 'IN_PROGRESS');
    }

    order.overallStatus = 'IN_PROGRESS';
    await order.save();

    await sendNotificationToRoles({
        roles: ["ADMIN", "DEPARTMENT_HEAD"],
        departmentId: order.workflow[0].departmentId,
        senderId: userId,
        type: "WORKFLOW_START",
        title: "New Order in Queue",
        body: `Order "${order.name}" has entered the ${order.workflow[0].departmentName} department. Production has officially started.`,
        data: {
            orderId: order._id.toString(),
            deptId: order.workflow[0].departmentId.toString(),
            screen: "/dept-head-dashboard" 
        }
    });

    await logAction(req, {
        action: "WORKFLOW_START",
        orderId: order._id,
        performedBy: userId,
        details: `Started workflow for Order ${order.name}. Primary Dept: ${order.workflow[0].departmentName}`,
        priority: "info"
    });

    res.status(200).json({ 
        success: true, 
        message: `Order launched into: ${order.workflow[0].departmentName}`, 
        order 
    });
});

