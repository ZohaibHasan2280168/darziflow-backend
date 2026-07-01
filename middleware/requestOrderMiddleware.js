// Add this to your orderRequest controller file
import { createOrder } from './../controllers/order/orderController.js';

export const convertRequestToOrder = asyncHandler(async (req, res) => {
    const { id } = req.params; 

    // 1. Fetch the request and client
    const request = await OrderRequest.findById(id).populate('clientId');
    if (!request || request.status === "CONVERTED") {
        return res.status(400).json({ message: "Invalid or already converted request." });
    }

    // 2. Grab the final agreed-upon numbers
    const finalProposal = request.proposals[request.proposals.length - 1];

    // 3. Trick your existing API by injecting the data directly into req.body!
    // This perfectly matches your Joi validation schema.
    req.body = {
        name: request.name,
        type: request.type,
        description: request.description,
        amount: finalProposal.proposedAmount,
        currency: finalProposal.proposedCurrency,
        dueDate: finalProposal.proposedDueDate,
        departmentSequenceIds: finalProposal.departmentSequenceIds,
        qcMemberId: finalProposal.qcMemberId,
        requiredDocTypes: finalProposal.proposedRequiredDocs, // Passes the docs string array
        clientName: request.clientId.name, 
        clientEmail: request.clientId.email, 
        clientId: request.clientId._id,
        
        // We pass this so the next function knows to link them!
        sourceRequestId: request._id 
    };

    // 4. Pass the request object directly to your existing API!
    return createOrder(req, res); 
});