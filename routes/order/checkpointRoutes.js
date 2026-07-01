import express from 'express';
import { protect, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  finalApproveCheckpoint,
  submitCheckpoint,
  approveCheckpoint,
  rejectCheckpoint,
  getQcHistory
} from '../../controllers/order/orderCheckpointController.js';

const router = express.Router();

router.use(protect);

router.get('/history', authorizeRoles('QC_MEMBER', 'ADMIN'), getQcHistory);

router.post('/:orderId/workflow/:opId/checkpoints/:chkId/submit', authorizeRoles('DEPARTMENT_HEAD', 'ADMIN'), submitCheckpoint);

router.patch('/:orderId/workflow/:opId/checkpoints/:chkId/approve', authorizeRoles('QC_MEMBER', 'ADMIN'), approveCheckpoint);

router.patch('/:orderId/workflow/:opId/checkpoints/:chkId/reject', authorizeRoles('QC_MEMBER', 'ADMIN'), rejectCheckpoint);

router.patch('/:orderId/workflow/:operationId/checkpoints/:checkpointId/final-approve', authorizeRoles('ADMIN'), finalApproveCheckpoint);

export default router;
