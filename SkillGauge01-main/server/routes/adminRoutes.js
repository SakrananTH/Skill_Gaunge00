import express from 'express';
import { requireAuth, authorizeRoles } from '../middlewares/auth.js';
import { userController } from '../controllers/userController.js';
import { workerController } from '../controllers/workerController.js';

const router = express.Router();

// User Management
router.get('/users', requireAuth, authorizeRoles('admin'), userController.listUsers);
router.post('/users', requireAuth, authorizeRoles('admin'), userController.createUser);
// router.get('/users/:id', ...);
// router.put('/users/:id', ...);
// router.delete('/users/:id', ...);

// Worker Management
router.get('/workers', requireAuth, authorizeRoles('admin', 'project_manager'), workerController.getAllWorkers);
router.get('/workers/:id', requireAuth, authorizeRoles('admin', 'project_manager'), workerController.getWorkerById);
router.post('/workers', requireAuth, authorizeRoles('admin'), workerController.createWorker);
// router.put('/workers/:id', ...);

export default router;
