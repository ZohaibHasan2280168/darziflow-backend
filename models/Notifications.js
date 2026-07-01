import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },    
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 

    type: { 
        type: String, 
        required: true,
        enum: [
            // User
            "USER_CREATE", "USER_UPDATE", "USER_DELETE",

            // Department
            "DEPT_CREATE", "DEPT_UPDATE", "DEPT_DELETE", "DEPT_REJECT",

            // Operation
            "OP_CREATE", "OP_UPDATE", "OP_DELETE",

            // Checkpoint CRUD
            "CHK_CREATE", "CHK_UPDATE", "CHK_DELETE",

            // Order CRUD
            "ORDER_CREATE", "ORDER_UPDATE", "ORDER_DELETE", "ORDER_ASSIGNED", "ORDER_COMPLETE",

            // Pre Req Upload
            "PREREQ_UPLOAD", "PREREQ_APPROVE", "PREREQ_REJECT",

            // Workflow Start
            "WORKFLOW_START",

            // Workflow Actions
            "CHK_SUBMIT", "CHK_APPROVE", "CHK_REJECT",
            "ADMIN_FINAL_APPROVE",

            // Order Request
            "REQUEST_CREATE", "REQUEST_PROPOSAL", "REQUEST_CONVERTED",

            // Message & Others
            "MESSAGE_SENT", "TEST_ALERT"
        ]
    },
    
    title: { type: String, required: true }, 
    body: { type: String, required: true },  

    data: { 
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, 
        requestId: { type: mongoose.Schema.Types.ObjectId, ref: "OrderRequest" }, 
        deptId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
        chatId: String,
        screen: { type: String, default: "NOTIFICATION_INBOX" } 
    },

    isRead: { type: Boolean, default: false },
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", NotificationSchema);
export default Notification;