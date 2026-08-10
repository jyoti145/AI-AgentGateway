import { Router } from 'express';
import { getAllAgents } from '../controllers/agent.controller.js';
import { verifyAccessToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';

const router = Router();

router.get('/', verifyAccessToken, authorizeRoles('admin'), getAllAgents);

export default router;
