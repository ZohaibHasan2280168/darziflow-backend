import Notification from '../models/Notifications.js';
import asyncHandler from 'express-async-handler';


export const getNotifications = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 }) 
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name role'); 

    const total = await Notification.countDocuments({ recipient: req.user._id });
    const unreadCount = await Notification.countDocuments({ 
        recipient: req.user._id, 
        isRead: false 
    });

    res.status(200).json({
        success: true,
        data: notifications,
        pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
            unreadCount
        }
    });
});

export const markAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user._id },
        { isRead: true },
        { new: true }
    );

    if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ success: true, data: notification });
});

export const markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { recipient: req.user._id, isRead: false },
        { isRead: true }
    );

    res.status(200).json({ success: true, message: "All notifications marked as read" });
});