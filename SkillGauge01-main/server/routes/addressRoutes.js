import express from 'express';
import { addressController } from '../controllers/addressController.js';

const router = express.Router();

router.get('/addresses', addressController.search);

export default router;
