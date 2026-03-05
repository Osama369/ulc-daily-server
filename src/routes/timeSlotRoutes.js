import express from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import timeSlotController from '../controllers/timeSlotController.js';

const router = express.Router();

// Admin: create time slot
router.post('/', authMiddleware, adminMiddleware, timeSlotController.createTimeSlot);

// Admin: update time slot
router.put('/:id', authMiddleware, adminMiddleware, timeSlotController.updateTimeSlot);

// Authenticated: list all timeslots
router.get('/', authMiddleware, timeSlotController.listTimeSlots);

// Authenticated: list active timeslots
router.get('/active', authMiddleware, timeSlotController.listActiveTimeSlots);

export default router;
