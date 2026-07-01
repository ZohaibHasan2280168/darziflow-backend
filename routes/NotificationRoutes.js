import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
    getNotifications, 
    markAsRead, 
    markAllAsRead 
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(protect); 

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

export default router;