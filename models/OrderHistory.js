import mongoose from "mongoose";

const OrderHistorySchema = new mongoose.Schema({
    // Optional: System events like "Order Placed" won't have a QC member
    qcMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, 
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderRequest', index: true },
    
    orderName: { type: String },
    departmentName: { type: String }, // Optional for system events
    operationName: { type: String },  // Optional for system events
    checkpointName: { type: String }, // Optional for system events
    
    action: { 
        type: String, 
        // EXPANDED ENUM: Added system-level events to your existing QC actions
        enum: [
            "REQUEST_CREATED", "PROPOSAL_ADDED",                     // Request
            "ORDER_PLACED", "DOCUMENTS_VERIFIED", "ORDER_COMPLETED", // System
            "SUBMIT", "APPROVE", "REJECT", "FINAL_APPROVE",          // QC
            "CLIENT_APPROVE", "CLIENT_REJECT", "CLIENT_DEPT_APPROVE" // Client
        ], 
        required: true 
    },
    
    // NEW: Frontend-ready fields so Flutter can just read and display
    displayTitle: { type: String },
    displayDescription: { type: String },
    
    comment: { type: String, default: "" },
}, { timestamps: true });

// Index for the Client Timeline (fetch everything for one order fast)
OrderHistorySchema.index({ orderId: 1, createdAt: -1 });
// Index for the QC Dashboard (fetch specific QC actions fast)
OrderHistorySchema.index({ qcMemberId: 1, createdAt: -1 });

const OrderHistory = mongoose.model("OrderHistory", OrderHistorySchema);
export default OrderHistory;
