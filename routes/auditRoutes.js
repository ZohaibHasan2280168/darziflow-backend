import express from 'express';
const router = express.Router();
import { getAuditLogs, markAsRead } from '../controllers/auditController.js';
import { protect, authorizeRoles} from '../middleware/authMiddleware.js'; // Use your actual middleware names

router.route('/').get(protect, authorizeRoles('ADMIN'), getAuditLogs);

router.route('/read').patch(protect, authorizeRoles('ADMIN'), markAsRead);
export default router;