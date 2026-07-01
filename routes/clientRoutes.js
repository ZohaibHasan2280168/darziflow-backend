import express from 'express';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { 
    getAllOrders, 
    getOrderProgress, 
    getRecentHistory, 
    getCompletedOrders,
    approveDepartment,
    rejectDepartment,
    getFullOrderTimeline
} from '../controllers/clientController.js';

const router = express.Router();

// Client All Orders

router.get('/all-orders', protect, authorizeRoles('CLIENT'), getAllOrders);

// Client - Order details (progess No with total chkpoints, completed checkpoints)

router.get('/order-progress/:orderId', protect, authorizeRoles('CLIENT'), getOrderProgress);

router.get('/getRecentHistory', protect, authorizeRoles('CLIENT'), getRecentHistory);

// Get the full timeline for a specific order or request
router.get('/timeline/:id', protect, authorizeRoles('CLIENT'), getFullOrderTimeline);

router.get('/getCompletedOrders', protect, authorizeRoles('CLIENT'), getCompletedOrders);

// Client Approval Workflow routes


router.post('/:orderId/departments/:deptId/approve', protect, authorizeRoles('CLIENT'), approveDepartment);

router.post('/:orderId/reject-department', protect, authorizeRoles('CLIENT'), rejectDepartment);

export default router;