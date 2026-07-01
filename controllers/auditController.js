import AuditLog from '../models/AuditLog_temp.js';
import asyncHandler from 'express-async-handler';



export const getAuditLogs = asyncHandler(async (req, res) => {
    const pageSize = 20;
    const page = Number(req.query.pageNumber) || 1;

    const keyword = req.query.action 
        ? { action: req.query.action } 
        : {};

    const count = await AuditLog.countDocuments({ ...keyword });
    
    const logs = await AuditLog.find({ ...keyword })
        .populate('performedBy', 'name role email') 
        .populate('orderId', 'name')       
        .sort({ createdAt: -1 })                    
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({ 
        logs, 
        page, 
        pages: Math.ceil(count / pageSize),
        total: count 
    });
});

export const markAsRead = asyncHandler(async (req, res) => {
    await AuditLog.updateMany({ isRead: false }, { $set: { isRead: true } });
    res.json({ message: "All notifications marked as read" });
});