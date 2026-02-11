// Olive Baby API - Routes Index
import { Router } from 'express';
import authRoutes from './auth.routes';
import caregiverRoutes from './caregiver.routes';
import babyRoutes from './baby.routes';
import routineRoutes from './routine.routes';
import statsRoutes from './stats.routes';
import growthRoutes, { babyGrowthRouter } from './growth.routes';
import milestoneRoutes, { babyMilestoneRouter } from './milestone.routes';
import vaccineRoutes, { babyVaccineRouter } from './vaccine.routes';
import exportRoutes from './export.routes';
import professionalRoutes, { babyProfessionalRouter } from './professional.routes';
import monitoringRoutes from './monitoring.routes';
import aiRoutes from './ai.routes';
import babyMemberRoutes from './baby-member.routes';
import babyInviteRoutes from './baby-invite.routes';
import settingsRoutes from './settings.routes';
import adminRoutes from './admin.routes';
import billingRoutes from './billing.routes';
import adminAiRoutes from './admin-ai.routes';
import onboardingRoutes from './onboarding.routes';
import notificationRoutes from './notification.routes';
import deviceTokenRoutes from './device-token.routes';
import clinicRoutes from './clinic.routes';
import appointmentRoutes from './appointment.routes';
import {
  babyClinicalVisitRouter,
} from './clinical-visit.routes';
import { babyPrescriptionRouter } from './prescription.routes';
import { babyMedicalCertificateRouter } from './medical-certificate.routes';
import { babyClinicalInfoRouter } from './baby-clinical-info.routes';
import patientInviteRoutes from './patient-invite.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/caregivers', caregiverRoutes);
router.use('/routines', routineRoutes);
router.use('/stats', statsRoutes);
router.use('/growth', growthRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/vaccines', vaccineRoutes);
router.use('/export', exportRoutes);
router.use('/professionals', professionalRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/ai', aiRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin', adminRoutes);
router.use('/billing', billingRoutes);
router.use('/admin/ai', adminAiRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/device-tokens', deviceTokenRoutes);
router.use('/clinics', clinicRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/patient-invites', patientInviteRoutes);

// IMPORTANTE: Rotas públicas de convite DEVEM vir ANTES de rotas com authMiddleware global
// Isso garante que /invites/verify-token seja acessível sem autenticação
router.use('/', babyInviteRoutes); // Rotas: /invites/* (públicas) e /babies/:babyId/invites

// Baby-scoped routes (nested under /babies/:babyId/)
// IMPORTANTE: Registrar rotas específicas ANTES das rotas genéricas de /babies
router.use('/babies/:babyId/professionals', babyProfessionalRouter);
router.use('/babies/:babyId/clinical-info', babyClinicalInfoRouter);
router.use('/babies/:babyId/visits', babyClinicalVisitRouter);
router.use('/babies/:babyId/prescriptions', babyPrescriptionRouter);
router.use('/babies/:babyId/certificates', babyMedicalCertificateRouter);
router.use('/babies/:babyId/growth', babyGrowthRouter);
router.use('/babies/:babyId/milestones', babyMilestoneRouter);
router.use('/babies/:babyId/vaccines', babyVaccineRouter);
router.use('/', babyMemberRoutes); // Rotas: /babies/:babyId/members

// Rotas genéricas de babies (deve vir por último para não capturar rotas específicas)
router.use('/babies', babyRoutes);

export default router;
