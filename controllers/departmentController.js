import User from '../models/User.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';
import Department from '../models/Department.js'; 
import { createDepartmentSchema, updateDepartmentSchema } from '../validations/departmentValidation.js';
import { logAction } from '../utils/auditLogger.js';
import { createAndSendNotification, sendNotificationToRoles } from "../services/notificationService.js";
import asyncHandler from 'express-async-handler';


export const createDepartment = asyncHandler(async (req, res) => {
    const { error, value } = createDepartmentSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    const department = await Department.create({
        ...value,
        createdBy: req.user._id,
    });

    await sendNotificationToRoles({
        roles: ["ADMIN", "DEPARTMENT_HEAD"],
        departmentId: department._id,
        senderId: req.user._id,
        type: "DEPT_CREATE",
        title: "New Department Created",
        body: `The ${department.name} department has been created.`,
        data: {
            deptId: department._id.toString(),
            screen: "/dept-head-dashboard"
        }
    });

    await logAction(req, {
        action: "DEPT_CREATE",
        performedBy: req.user._id,
        deptId: department._id,
        details: `New department created: ${department.name}`,
        priority: "success"
    });

    res.status(201).json(department);
});

export const getDepartments = asyncHandler(async (req, res) => {
    const departments = await Department.find()
        .select('-operations') 
        .populate('departmentHead', 'name email'); 

    res.status(200).json(departments);
});

export const getDepartmentById = asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.deptId)
        .populate('departmentHead', 'name email'); 
    
    if (!department) {
        return res.status(404).json({ message: 'Department template not found' });
    }
    res.status(200).json(department);
});

export const updateDepartment = asyncHandler(async (req, res) => {
    const { error, value } = updateDepartmentSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    const department = await Department.findByIdAndUpdate(
        req.params.deptId, 
        value, 
        { new: true, runValidators: true }
    );

    if (!department) {
        return res.status(404).json({ message: 'Department template not found' });
    }

    await sendNotificationToRoles({
        roles: ["ADMIN", "DEPARTMENT_HEAD"],
        departmentId: department._id,
        senderId: req.user._id,
        type: "DEPT_UPDATE",
        title: "Department Updated",
        body: `The ${department.name} department has been updated.`,
        data: {
            deptId: department._id.toString(),
            screen: "/dept-head-dashboard"
        }
    });

    await logAction(req, {
        action: "DEPT_UPDATE",
        performedBy: req.user._id,
        deptId: department._id,
        details: `Department updated: ${department.name}`,
        priority: "success"
    });

    res.status(200).json(department);
});

export const deleteDepartment = asyncHandler(async (req, res) => {
    const department = await Department.findByIdAndUpdate(
        req.params.deptId, 
        { status: 'INACTIVE' }, 
        { new: true }
    );

    if (!department) {
        return res.status(404).json({ message: 'Department template not found' });
    }

    await sendNotificationToRoles({
        roles: ["ADMIN", "DEPARTMENT_HEAD"],
        departmentId: department._id,
        senderId: req.user._id,
        type: "DEPT_UPDATE",
        title: "Department Deactivated",
        body: `The ${department.name} department has been marked as INACTIVE.`,
        data: {
            deptId: department._id.toString(),
            screen: "/dept-head-dashboard"
        }
    });

    await logAction(req, {
        action: "DEPT_DELETE",
        performedBy: req.user._id,
        deptId: department._id,
        details: `Department deleted: ${department.name}`,
        priority: "success"
    });

    res.status(200).json({ 
        message: 'Department template deactivated successfully', 
        id: department._id 
    });
});

export const getDepartmentOverview = asyncHandler(async (req, res) => {
    
    const deptId = req.params.deptId || req.user.department;

    if (!deptId) {
        return res.status(400).json({ 
            success: false, 
            message: "No department ID provided or associated with this user." 
        });
    }

    const deptObjectId = new mongoose.Types.ObjectId(deptId);

    const deptDetails = await Department.findById(deptObjectId).lean();

    if (!deptDetails) {
        return res.status(404).json({ success: false, message: "Department not found." });
    }

    // Calculate template stats
    const templateOperations = deptDetails.operations?.length || 0;
    let templateCheckpoints = 0;
    deptDetails.operations?.forEach(op => {
        templateCheckpoints += op.checkpoints?.length || 0;
    });

    const allOrders = await Order.find({
        "departmentSequence": deptObjectId
    }).lean();

    const totalOrders = allOrders.length;
    let inProgressOrders = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    
    let totalOperationsHandled = 0;
    let completedOps = 0;
    let pendingOps = 0;
    let inProgressOps = 0;
    let rejectedOps = 0;
    
    let totalCheckpoints = 0;
    let completedCheckpoints = 0;
    let pendingCheckpoints = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    allOrders.forEach(order => {
        if (order.overallStatus === 'IN_PROGRESS') {
            inProgressOrders++;
        } else if (order.overallStatus === 'READY_TO_START' || order.overallStatus === 'DOCS_PENDING') {
            pendingOrders++;
        } else if (order.overallStatus === 'COMPLETED') {
            completedOrders++;
        }

        if (order.workflow && order.workflow.length > 0) {
        
            
            const deptWorkflow = order.workflow.find(w => {
                if (!w.departmentId) return false;
                
                const workflowDeptIdStr = w.departmentId.toString();
                const targetDeptIdStr = deptId.toString();
                
                
                return workflowDeptIdStr === targetDeptIdStr;
            });
            
            if (deptWorkflow) {
               
                if (deptWorkflow.operations && deptWorkflow.operations.length > 0) {
                    deptWorkflow.operations.forEach(op => {
                        totalOperationsHandled++;
                        
                        // Count operation status
                        if (op.status === 'COMPLETED') {
                            completedOps++;
                        } else if (op.status === 'IN_PROGRESS') {
                            inProgressOps++;
                        } else if (op.status === 'REJECTED') {
                            rejectedOps++;
                        } else {
                            pendingOps++;
                        }

                        if (op.checkpoints && op.checkpoints.length > 0) {
                            op.checkpoints.forEach(checkpoint => {
                                totalCheckpoints++;
                                
                                if (checkpoint.status === 'COMPLETED' || 
                                    checkpoint.status === 'QC_APPROVED' || 
                                    checkpoint.status === 'SUBMITTED') {
                                    completedCheckpoints++;
                                } else {
                                    pendingCheckpoints++;
                                }

                                if (checkpoint.history && checkpoint.history.length > 0) {
                                    checkpoint.history.forEach(history => {
                                        if (history.action === 'APPROVE' || history.action === 'FINAL_APPROVE') {
                                            approvedCount++;
                                        } else if (history.action === 'REJECT') {
                                            rejectedCount++;
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            } else {
            }
        } 
    });
    const totalReviews = approvedCount + rejectedCount;
    const qualityScore = totalReviews > 0 
        ? Math.round((approvedCount / totalReviews) * 100) 
        : 100;

    res.status(200).json({
        success: true,
        department: deptDetails,
        templateStats: {
            totalOperations: templateOperations,
            totalCheckpoints: templateCheckpoints
        },
        orderStats: {
            totalOrders,
            inProgress: inProgressOrders,
            pending: pendingOrders,
            completed: completedOrders
        },
        operationStats: {
            totalOperationsHandled,
            completed: completedOps,
            pending: pendingOps,
            inProgress: inProgressOps,
            rejected: rejectedOps
        },
        checkpointStats: {
            totalCheckpoints,
            completed: completedCheckpoints,
            pending: pendingCheckpoints
        },
        qualityStats: {
            score: qualityScore,
            approved: approvedCount,
            rejected: rejectedCount
        }
    });
});