import OrderRequest from '../../models/OrderRequest.js';
import asyncHandler from 'express-async-handler';
import { createOrder } from './orderController.js';
import { createAndSendNotification, sendNotificationToRoles } from "../../services/notificationService.js";
import OrderHistory from '../../models/OrderHistory.js';

// @desc    Client creates the initial request
// @route   POST /api/requests
export const createOrderRequest = asyncHandler(async (req, res) => {
    const { name, type, description, targetDueDate, originalReferenceFiles } = req.body;

    const request = await OrderRequest.create({
        name,
        type,
        description,
        targetDueDate,
        originalReferenceFiles: originalReferenceFiles || [],
        clientName: req.user.name,
        clientEmail: req.user.email,
        clientId: req.user._id,
        status: "PENDING_ADMIN",
        proposals: []
    });

    await OrderHistory.create({
        clientId: req.user._id,
        requestId: request._id,
        orderName: request.name,
        action: "REQUEST_CREATED",
        displayTitle: "Quote Request Submitted",
        displayDescription: `You submitted a new quote request for "${request.name}".`
    });

    // Notify Admin: "New Quote Request Received"
    await sendNotificationToRoles({
        roles: ["ADMIN"],
        senderId: req.user._id,
        type: "REQUEST_CREATE",
        title: "New Quote Request",
        body: `New request "${request.name}" from ${req.user.name}`,
        data: {
            requestId: request._id.toString(),
            screen: "/admin-requests"
        }
    });

    res.status(201).json({ success: true, data: request });
});

// @desc    Add a counter-offer (Admin or Client)
// @route   POST /api/requests/:id/proposals
export const addProposal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        amount, dueDate, requiredDocs, departmentSequenceIds,
        qcMemberId, referenceFiles, remarks
    } = req.body;

    const userRole = req.user.role === 'CLIENT' ? 'CLIENT' : 'ADMIN';

    const request = await OrderRequest.findById(id);
    if (!request || request.status === "CONVERTED") {
        return res.status(400).json({ message: "Invalid or closed request." });
    }

    // Push the new version
    request.proposals.push({
        proposedByRole: userRole,
        proposedAmount: amount,
        proposedDueDate: dueDate,
        proposedRequiredDocs: requiredDocs,
        departmentSequenceIds,
        qcMemberId,
        proposedReferenceFiles: referenceFiles || [],
        remarks
    });

    // Flip the status to the OTHER party
    request.status = userRole === 'ADMIN' ? 'PENDING_CLIENT' : 'PENDING_ADMIN';
    await request.save();

    await OrderHistory.create({
        clientId: request.clientId,
        requestId: request._id,
        orderName: request.name,
        action: "PROPOSAL_ADDED",
        displayTitle: userRole === 'CLIENT' ? "Counter-Offer Submitted" : "New Proposal Received",
        displayDescription: userRole === 'CLIENT' 
            ? `You submitted a new counter-offer for "${request.name}".`
            : `Admin sent a new proposal for "${request.name}".`,
        comment: remarks || ""
    });

    // Notify the opposing party
    if (userRole === 'CLIENT') {
        // Notify Admins
        await sendNotificationToRoles({
            roles: ["ADMIN"],
            senderId: req.user._id,
            type: "REQUEST_PROPOSAL",
            title: "Client Responded",
            body: `${req.user.name} updated the proposal for "${request.name}"`,
            data: {
                requestId: request._id.toString(),
                screen: "/admin-requests"
            }
        });
    } else {
        // Notify the Client
        await createAndSendNotification({
            recipientId: request.clientId,
            senderId: req.user._id,
            type: "REQUEST_PROPOSAL",
            title: "New Proposal Received",
            body: `Admin has sent a new proposal for "${request.name}"`,
            data: {
                requestId: request._id.toString(),
                screen: "/requests"
            }
        });
    }

    res.status(200).json({ success: true, data: request });
});

// @desc    Admin converts the request to a hard Order (The Proxy)
// @route   POST /api/requests/:id/convert
export const convertRequestToOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await OrderRequest.findById(id).populate('clientId');
    if (!request || request.status === "CONVERTED" || request.proposals.length === 0) {
        return res.status(400).json({ message: "Cannot convert this request." });
    }

    const finalProposal = request.proposals[request.proposals.length - 1];

    // File Fallback Logic
    let finalBlueprints = request.originalReferenceFiles;
    for (let i = request.proposals.length - 1; i >= 0; i--) {
        if (request.proposals[i].proposedReferenceFiles?.length > 0) {
            finalBlueprints = request.proposals[i].proposedReferenceFiles;
            break;
        }
    }

    // Inject exact payload for createOrder
    req.body = {
        name: request.name,
        type: request.type,
        description: request.description,
        amount: finalProposal.proposedAmount,
        currency: finalProposal.proposedCurrency,
        dueDate: finalProposal.proposedDueDate,
        departmentSequenceIds: finalProposal.departmentSequenceIds,
        qcMemberId: finalProposal.qcMemberId,
        requiredDocTypes: finalProposal.proposedRequiredDocs,
        clientName: request.clientId.name,
        clientEmail: request.clientId.email,
        clientId: request.clientId._id,
        approvedBlueprints: finalBlueprints, // NEW
        sourceRequestId: request._id // NEW: The trigger link
    };

    // Pass baton to existing controller
    return createOrder(req, res);
});