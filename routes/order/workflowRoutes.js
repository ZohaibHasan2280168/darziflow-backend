import express from 'express';
import { protect, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  uploadPrerequisiteDocument,
  startWorkflow,
  approvePrerequisite,
  rejectPrerequisite
} from '../../controllers/order/workflowController.js';

const router = express.Router();

router.use(protect);

router.post('/:orderId/prerequisites/:docType', authorizeRoles('ADMIN', 'CLIENT'), uploadPrerequisiteDocument);

router.patch('/:orderId/prerequisite/:docType/approve', authorizeRoles('ADMIN'), approvePrerequisite);

router.patch('/:orderId/prerequisite/:docType/reject', authorizeRoles('ADMIN'), rejectPrerequisite);

router.put('/:orderId/start-workflow', authorizeRoles('ADMIN'), startWorkflow);

export default router;
