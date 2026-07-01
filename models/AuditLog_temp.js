import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema({
    action: { 
        type: String, 
        required: true, 
        enum: [
            // Auth & User Management
            "SIGNUP", "LOGIN", "LOGOUT", "CHANGE_PASSWORD", 
            "USER_CREATE", "USER_DELETE","USER_UPDATE", "ROLE_ASSIGN",
            // Department & Template Management
            "DEPT_CREATE", "DEPT_UPDATE", "DEPT_DELETE",
            "OP_CREATE", "OP_UPDATE", "OP_DELETE",
            "CHK_CREATE", "CHK_UPDATE", "CHK_DELETE",
            // Order Management & Workflow
            "ORDER_CREATE", "ORDER_UPDATE", "ORDER_DELETE",
            "ORDER_ASSIGNED", // When order enters a dept (Alert Dept Head)
            "PREREQ_UPLOAD", "PREREQ_APPROVE", "PREREQ_REJECT",
            "WORKFLOW_START", 
            "CHK_SUBMIT", "CHK_APPROVE", "CHK_REJECT", // QC Loop
            // Communication
            "MESSAGE_SENT" 
        ] 
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientRole: { type: String }, // Target role (e.g., "DEPT_HEAD")
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // For direct messages
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    deptId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    details: { type: String, required: true },
    isRead: { type: Boolean, default: false }, // Useful for the In-App Inbox
    priority: { 
        type: String, 
        enum: ["info", "warning", "error", "success"], 
        default: "info" 
    }
}, { timestamps: true });

const AuditLog = mongoose.model("AuditLog", AuditLogSchema);
export default AuditLog;