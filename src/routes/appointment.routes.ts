// Olive Baby API - Appointment Routes
import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller';
import { authenticate, requireProfessional } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, requireProfessional, appointmentController.listAppointments);
router.get('/available-slots', authenticate, requireProfessional, appointmentController.getAvailableSlots);
router.post('/', authenticate, requireProfessional, appointmentController.createAppointment);
router.get('/schedule', authenticate, requireProfessional, appointmentController.getSchedule);
router.post('/schedule', authenticate, requireProfessional, appointmentController.upsertSchedule);
router.get('/exceptions', authenticate, requireProfessional, appointmentController.listExceptions);
router.post('/exceptions', authenticate, requireProfessional, appointmentController.createException);
router.get('/:id', authenticate, requireProfessional, appointmentController.getAppointment);
router.patch('/:id/status', authenticate, requireProfessional, appointmentController.updateAppointmentStatus);
router.post('/:id/cancel', authenticate, requireProfessional, appointmentController.cancelAppointment);

export default router;
