import AuditLog from '../models/AuditLog_temp.js';

/**
 * @param {Object} req - Express request object (to get user and IP)
 * @param {Object} data - Log details { action, details, orderId, deptId, priority }
 */
export const logAction = async (req, data) => {
    try {
        const { action, details, orderId, deptId, priority = "info" } = data;

        const log = await AuditLog.create({
            action,
            details,
            orderId,
            deptId,
            performedBy: req.user?._id || data.performedBy, // Fallback for signup/login where req.user isn't set yet
            ipAddress: req.ip,
            priority
        });

        // Emit to Web App Admin Room
        const io = req.app.get("socketio");
        if (io) {
            io.to("admin_room").emit("admin_notification", {
                message: details,
                action,
                performedBy: req.user?.name || "System",
                createdAt: log.createdAt,
                priority
            });
        }
        return log;
    } catch (error) {
        console.error("Audit Log Error:", error);
    }
};