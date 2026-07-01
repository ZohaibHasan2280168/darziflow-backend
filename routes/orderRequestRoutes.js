import express from 'express';
import {
    createOrderRequest,
    addProposal,
    convertRequestToOrder
} from '../controllers/order/orderRequestController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Client creates initial request
router.post('/', protect, createOrderRequest);

// Either party can add a proposal/counter
router.post('/:id/proposals', protect, addProposal);

// Admin converts it to an order
router.post('/:id/convert', protect, authorizeRoles('ADMIN', 'MODERATOR'), convertRequestToOrder);

export default router;