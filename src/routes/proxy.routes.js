import { Router } from 'express';
import { proxyChat } from '../controllers/proxy.controller.js';
import { verifyAccessToken } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/chat', verifyAccessToken, proxyChat);

export default router;
