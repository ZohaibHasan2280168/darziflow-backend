import express from 'express';
import * as chatController from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js'; 

const router = express.Router();

router.use(protect);

// Room management routes
router.get('/rooms', chatController.getRecentChats);
router.post('/rooms/direct', chatController.getOrCreateDirectRoom);

// User search route
router.get('/users/search', chatController.searchGlobalUsers);

// Message retrieval route
router.get('/rooms/:roomId/messages', chatController.getChatMessages);

export default router;