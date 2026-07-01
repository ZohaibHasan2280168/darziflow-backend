import mongoose from "mongoose";
import asyncHandler from 'express-async-handler';
import Order, { decrypt } from '../models/Order.js';

export const getActiveWorkflows = asyncHandler(async (req, res) => {
    const { deptId } = req.params;
    const deptObjectId = new mongoose.Types.ObjectId(deptId);

    const activeOrders = await Order.aggregate([
        { $match: { 
            "workflow.departmentId": deptObjectId,
            "overallStatus": { $ne: "COMPLETED" } 
        }},
        {
            $project: {
                orderName: "$name",
                dueDate: 1,
                 myWork: {
                    $filter: {
                        input: "$workflow",
                        as: "w",
                        cond: { $eq: ["$$w.departmentId", deptObjectId] }
                    }
                }
            }
        },
        { $unwind: "$myWork" },
        {
            $project: {
                orderName: 1,
                dueDate: 1,
                overallStatus: 1,
                workflow: ["$myWork"],
                operations: "$myWork.operations", 
                progress: {
                    $multiply: [
                        { $divide: [
                            { $size: { $filter: { input: "$myWork.operations", as: "o", cond: { $eq: ["$$o.status", "COMPLETED"] } } } },
                            { $size: "$myWork.operations" }
                        ]},
                        100
                    ]
                }
            }
        }
    ]);

// Because aggregate bypasses Mongoose schema getters, we decrypt manually
    const decryptedOrders = activeOrders.map(order => {
        if (order.operations) {
            order.operations.forEach(op => {
                if (op.checkpoints) {
                    op.checkpoints.forEach(chk => {
                        if (chk.submissionText) {
                            chk.submissionText = decrypt(chk.submissionText);
                        }
                    });
                }
            });
        }
        return order;
    });

    res.status(200).json({
        success: true,
        count: decryptedOrders.length,
        orders: decryptedOrders 
    });
});

export const getAllDepartmentWorkflows = asyncHandler(async (req, res) => {
    const { deptId } = req.params;
    const deptObjectId = new mongoose.Types.ObjectId(deptId);

    const allAssignedOrders = await Order.aggregate([
        { 
            $match: { 
                "departmentSequence": { $in: [deptObjectId, deptId] } 
            }
        },
        {
            $project: {
                orderName: "$name",
                dueDate: 1,
                overallStatus: 1,
                myWork: {
                    $filter: {
                        input: { $ifNull: ["$workflow", []] }, 
                        as: "w",
                        cond: { $eq: [{ $toString: "$$w.departmentId" }, deptId] }
                    }
                }
            }
        },
        { $unwind: { path: "$myWork", preserveNullAndEmptyArrays: true } }, 
        {
            $project: {
                orderName: 1,
                dueDate: 1,
                overallStatus: 1,
                workflow: ["$myWork"],
                departmentStatus: { $ifNull: ["$myWork.status", "PENDING"] }, 
                operations: { $ifNull: ["$myWork.operations", []] }, 
                progress: {
                    $cond: {
                        if: { 
                            $or: [
                                { $eq: [{ $type: "$myWork" }, "missing"] },
                                { $eq: [{ $type: "$myWork.operations" }, "missing"] },
                                { $eq: [{ $size: { $ifNull: ["$myWork.operations", []] } }, 0] }
                            ]
                        },
                        then: 0, 
                        else: {
                            $multiply: [
                                { $divide: [
                                    { $size: { $filter: { input: "$myWork.operations", as: "o", cond: { $eq: ["$$o.status", "COMPLETED"] } } } },
                                    { $size: "$myWork.operations" }
                                ]},
                                100
                            ]
                        }
                    }
                }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        count: allAssignedOrders.length,
        orders: allAssignedOrders
    });
});

export const getQcStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const qcObjectId = new mongoose.Types.ObjectId(userId); // Explicitly cast to ObjectId
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const stats = await Order.aggregate([
        { $match: { qcMember: qcObjectId } }, 
        
        { $unwind: "$workflow" },
        { $unwind: "$workflow.operations" },
        { $unwind: "$workflow.operations.checkpoints" },
        {
            $facet: {
                pendingReviews: [
                    { $match: { "workflow.operations.checkpoints.status": "SUBMITTED" } }, 
                    { $count: "count" }
                ],
                activityToday: [
                    { $unwind: "$workflow.operations.checkpoints.history" },
                    { 
                        $match: { 
                            "workflow.operations.checkpoints.history.actedBy": qcObjectId, // Use objectId here too
                            "workflow.operations.checkpoints.history.actedAt": { $gte: startOfDay }
                        } 
                    },
                    {
                        $group: {
                            _id: "$workflow.operations.checkpoints.history.action",
                            count: { $sum: 1 }
                        }
                    }
                ]
            }
        }
    ]);

    const pendingCount = stats[0].pendingReviews[0]?.count || 0;
    const activity = stats[0].activityToday || [];
    const approvedToday = activity.find(a => a._id === 'APPROVE')?.count || 0;
    const rejectedToday = activity.find(a => a._id === 'REJECT')?.count || 0;

    res.status(200).json({ 
        success: true,
        pending_reviews: pendingCount, 
        approved_today: approvedToday, 
        rejected_today: rejectedToday 
    });
});

export const getPendingSubmissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const qcObjectId = new mongoose.Types.ObjectId(userId); // Explicitly cast to ObjectId

    const pendingTasks = await Order.aggregate([
        { $match: { qcMember: qcObjectId } }, 

        { $unwind: "$workflow" },
        { $unwind: "$workflow.operations" },
        { $unwind: "$workflow.operations.checkpoints" },
        { 
            $match: { 
                "workflow.operations.checkpoints.status": "SUBMITTED"
            } 
        },
        {
            $project: {
                orderId: "$_id",
                orderName: "$name",
                departmentName: "$workflow.departmentName",
                operationId: "$workflow.operations._id",
                checkpointId: "$workflow.operations.checkpoints._id",
                checkpointName: "$workflow.operations.checkpoints.name",
                submissionFiles: "$workflow.operations.checkpoints.submissionFiles",
                submissionText: "$workflow.operations.checkpoints.submissionText", 
                submittedAt: { $arrayElemAt: ["$workflow.operations.checkpoints.history.actedAt", -1] } 
            }
        },
        { $sort: { submittedAt: -1 } } 
    ]);

    const decryptedTasks = pendingTasks.map(task => {
        if (task.submissionText) {
            task.submissionText = decrypt(task.submissionText);
        }
        return task;
    });

    res.status(200).json({ 
        success: true, 
        count: decryptedTasks.length, 
        data: decryptedTasks 
    });
});
