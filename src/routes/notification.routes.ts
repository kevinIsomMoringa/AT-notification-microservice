import { Router } from 'express';
import { sendNotification } from '../controllers/notification.controller';

const router = Router();

// POST /api/v1/notifications
router.post('/notifications', sendNotification);

export default router;
