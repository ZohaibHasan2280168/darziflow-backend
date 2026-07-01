import express from 'express';
import { protect, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  createOrder,
  assignQCMember,
  getOrderWorkflow,
  getOrders,
  getOrderDetails,
  updateOrderMetadata,
  deleteOrder
} from '../../controllers/order/orderController.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(authorizeRoles('DEPARTMENT_HEAD', 'ADMIN', 'CLIENT'), createOrder)
  .get(authorizeRoles('DEPARTMENT_HEAD', 'ADMIN', 'QC_MEMBER', 'CLIENT'), getOrders);

router.route('/:orderId')
  .get(authorizeRoles('DEPARTMENT_HEAD', 'ADMIN', 'QC_MEMBER', 'CLIENT'), getOrderDetails)
  .put(authorizeRoles('DEPARTMENT_HEAD', 'ADMIN', 'CLIENT'), updateOrderMetadata)
  .delete(authorizeRoles('ADMIN'), deleteOrder);

router.get('/:orderId/workflow', authorizeRoles('DEPARTMENT_HEAD', 'ADMIN', 'QC_MEMBER'), getOrderWorkflow);

router.patch('/:orderId/assign-qc', authorizeRoles('ADMIN', 'DEPARTMENT_HEAD', 'CLIENT'), assignQCMember);

export default router;
