import mongoose from "mongoose";
import { encrypt, decrypt } from "./Order.js"; // Import your existing encryption

const AttachedFileSchema = new mongoose.Schema({
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, default: "auto" }
}, { _id: false });

const ProposalSchema = new mongoose.Schema({
    proposedByRole: { type: String, enum: ["ADMIN", "CLIENT"], required: true },
    proposedAmount: { type: Number },
    proposedCurrency: { type: String, default: "Rs." },
    proposedDueDate: { type: Date },
    proposedRequiredDocs: [{ type: String }],
    departmentSequenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    qcMemberId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    proposedReferenceFiles: [AttachedFileSchema], 
    remarks: { type: String }, 
    createdAt: { type: Date, default: Date.now }
});

const OrderRequestSchema = new mongoose.Schema({
    // Immutable Original Ask
    name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String, required: true },
    targetDueDate: { type: Date, required: true },
    originalReferenceFiles: [AttachedFileSchema], // The Client's initial Tech Pack

    // Encrypted Client Profile
    clientName: { type: String, required: true, get: decrypt, set: encrypt },
    clientEmail: { type: String, required: true, get: decrypt, set: encrypt },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // The Version History
    proposals: [ProposalSchema], 

    // Bi-Directional Linking
    finalOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },

    status: { 
        type: String, 
        enum: ["PENDING_ADMIN", "PENDING_CLIENT", "CONVERTED", "CANCELED"],
        default: "PENDING_ADMIN"
    }
}, { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } });

const OrderRequest = mongoose.model("OrderRequest", OrderRequestSchema);
export default OrderRequest;