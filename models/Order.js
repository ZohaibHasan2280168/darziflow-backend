import mongoose from "mongoose";
import crypto from "crypto";

// Encryption Configuration
const ALGORITHM = "aes-256-cbc";
const KEY = crypto.createHash("sha256").update(process.env.DATABASE_ENCRYPTION_KEY).digest();
const IV_LENGTH = 16; 

export const encrypt = (text) => {
    if (!text || text.includes(":")) return text; // Don't double-encrypt
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
};

export const decrypt = (text) => {
    if (!text || !text.includes(":")) return text; // If not encrypted, return as is
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

const PrerequisiteDocumentSchema = new mongoose.Schema({
    docType: { type: String, required: true },
    status: {
        type: String, 
        enum: ["PENDING", "UPLOADED", "APPROVED"], 
        default: "PENDING"
    },
    fileUrl: { type: String, default: "" },
    filePublicId: { type: String, default: "" }, 
    resourceType: { type: String, default: "auto" },
    
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { _id: true });

const CheckpointInstanceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    allowedSubmissionTypes: { type: [String], enum: ["TEXT", "IMAGE", "VIDEO", "DOCUMENT"] },
    minRequiredUploads: { type: Number, default: 0 },
    status: { 
        type: String, 
        enum: ["PENDING", "SUBMITTED", "QC_APPROVED", "QC_REJECTED", "COMPLETED"], 
        default: "PENDING" 
    },
    submissionText: { 
        type: String, 
        default: "",
        get: decrypt,
        set: encrypt,
    },
    submissionFiles: [{
        url: String,
        publicId: String,
        resourceType: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploadedAt: Date
    }],
}, { 
    _id: true,
    toJSON: { getters: true },   
    toObject: { getters: true }  
});

const OperationInstanceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    status: { 
        type: String, 
        enum: ["PENDING", "IN_PROGRESS", "COMPLETED"], 
        default: "PENDING" 
    },
    checkpoints: [CheckpointInstanceSchema]
}, { _id: true });

const OrderSchema = new mongoose.Schema({
    uniqueId: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    type: { type: String, enum: ["PANT", "SHORTS", "JACKET", "OTHER"], required: true }, 
    description: { type: String },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "Rs." },
    requiredDocuments : [PrerequisiteDocumentSchema],
    dueDate: { type: Date },
    
    clientName: { 
        type: String, 
        required: false,
        get: decrypt,
        set: encrypt
    },
    clientEmail: { 
        type: String,
        get: decrypt,
        set: encrypt
    },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    qcMember: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    departmentSequence: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true }],
    workflow: [{
        departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
        departmentName: { type: String, required: true },
        operations: [OperationInstanceSchema],
        status: { 
            type: String, 
            enum: ["PENDING", "IN_PROGRESS", "CLIENT_APPROVAL_PENDING", "COMPLETED", "CLIENT_REJECTED"],
            default: "PENDING"
        },
    }],
    overallStatus: {
        type: String, 
        enum: ["DRAFT", "DOCS_PENDING", "READY_TO_START", "IN_PROGRESS", "COMPLETED"],
        default: "DRAFT"
    },
    approvedBlueprints: [{
        fileName: String,
        fileUrl: String,
        publicId: String,
        resourceType: String
    }],
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "OrderRequest", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { 
    timestamps: true,
    toJSON: { getters: true },   
    toObject: { getters: true }  
});


const Order = mongoose.model("Order", OrderSchema);
export default Order;