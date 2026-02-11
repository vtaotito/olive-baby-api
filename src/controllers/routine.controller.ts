// Olive Baby API - Routine Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { RoutineService } from '../services/routine.service';
import { CaregiverService } from '../services/caregiver.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';
import { hasBabyAccess } from '../utils/helpers/baby-permission.helper';

// Schemas de validação
export const createRoutineSchema = z.object({
  babyId: z.number().positive(),
  routineType: z.enum(['FEEDING', 'SLEEP', 'DIAPER', 'BATH', 'MILK_EXTRACTION']),
  startTime: z.string().datetime().transform(val => new Date(val)),
  endTime: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const updateRoutineSchema = z.object({
  startTime: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endTime: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const startRoutineSchema = z.object({
  babyId: z.number().positive(),
  notes: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const closeRoutineSchema = z.object({
  babyId: z.number().positive(),
  notes: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const instantRoutineSchema = z.object({
  babyId: z.number().positive(),
  notes: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const listRoutinesQuerySchema = z.object({
  babyId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  routineType: z.enum(['FEEDING', 'SLEEP', 'DIAPER', 'BATH', 'MILK_EXTRACTION']).optional(),
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

export class RoutineController {
  private static async getCaregiverId(userId: number): Promise<number> {
    const caregiver = await CaregiverService.getByUserId(userId);
    return caregiver.id;
  }

  // ==========================================
  // CRUD Básico
  // ==========================================

  static async create(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const data = req.body;
      const routine = await RoutineService.create(caregiverId, data);

      res.status(201).json({
        success: true,
        message: 'Registro criado com sucesso',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const query = req.query as any;
      
      const result = await RoutineService.list(
        caregiverId,
        {
          babyId: query.babyId,
          routineType: query.routineType,
          startDate: query.startDate,
          endDate: query.endDate,
        },
        query.page,
        query.limit
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      } as any);
    } catch (error) {
      next(error);
    }
  }

  // Lista rotinas de um bebê específico (usando babyId como path param)
  // Suporta tanto cuidadores quanto profissionais de saúde
  static async listByBaby(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const query = req.query as any;

      // Verificar acesso ao bebê (cuidador OU profissional)
      const hasAccess = await hasBabyAccess(req.user.userId, babyId);
      if (!hasAccess) {
        throw AppError.forbidden('Você não tem acesso a este bebê');
      }

      // Converter parâmetros de query
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      let routineType: string | undefined;

      if (query.startDate) {
        startDate = new Date(query.startDate);
      }
      if (query.endDate) {
        endDate = new Date(query.endDate);
      }
      if (query.type || query.routineType) {
        routineType = query.type || query.routineType;
      }

      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      
      // Usar listByBabyId que não requer caregiverId (acesso já validado acima)
      const result = await RoutineService.listByBabyId(
        babyId,
        {
          routineType: routineType as any,
          startDate,
          endDate,
        },
        page,
        limit
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      } as any);
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const id = parseInt(req.params.id, 10);
      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const routine = await RoutineService.getById(id, caregiverId);

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const id = parseInt(req.params.id, 10);
      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const data = req.body;
      const routine = await RoutineService.update(id, caregiverId, data);

      res.status(200).json({
        success: true,
        message: 'Registro atualizado com sucesso',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const id = parseInt(req.params.id, 10);
      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      await RoutineService.delete(id, caregiverId);

      res.status(200).json({
        success: true,
        message: 'Registro removido com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Rotinas com Timer
  // ==========================================

  static async startSleep(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.startRoutine(caregiverId, babyId, 'SLEEP', meta, notes);

      res.status(201).json({
        success: true,
        message: 'Sono iniciado',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async closeSleep(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.closeRoutine(caregiverId, babyId, 'SLEEP', meta, notes);

      res.status(200).json({
        success: true,
        message: 'Sono finalizado',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOpenSleep(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.query.babyId as string, 10);
      const routine = await RoutineService.getOpenRoutine(caregiverId, babyId, 'SLEEP');

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async startFeeding(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.startRoutine(caregiverId, babyId, 'FEEDING', meta, notes);

      res.status(201).json({
        success: true,
        message: 'Alimentação iniciada',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async closeFeeding(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.closeRoutine(caregiverId, babyId, 'FEEDING', meta, notes);

      res.status(200).json({
        success: true,
        message: 'Alimentação finalizada',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOpenFeeding(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.query.babyId as string, 10);
      const routine = await RoutineService.getOpenRoutine(caregiverId, babyId, 'FEEDING');

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async startBath(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.startRoutine(caregiverId, babyId, 'BATH', meta, notes);

      res.status(201).json({
        success: true,
        message: 'Banho iniciado',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async closeBath(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.closeRoutine(caregiverId, babyId, 'BATH', meta, notes);

      res.status(200).json({
        success: true,
        message: 'Banho finalizado',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOpenBath(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.query.babyId as string, 10);
      const routine = await RoutineService.getOpenRoutine(caregiverId, babyId, 'BATH');

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Endpoint Genérico - Verificar Rotina Aberta
  // ==========================================

  static async getOpenRoutine(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.query.babyId as string, 10);
      const routineType = req.query.routineType as string;

      if (!babyId || !routineType) {
        throw AppError.badRequest('babyId e routineType são obrigatórios');
      }

      const validTypes = ['FEEDING', 'SLEEP', 'BATH', 'MILK_EXTRACTION'];
      if (!validTypes.includes(routineType.toUpperCase())) {
        throw AppError.badRequest(`Tipo de rotina inválido. Use: ${validTypes.join(', ')}`);
      }

      const routine = await RoutineService.getOpenRoutine(
        caregiverId, 
        babyId, 
        routineType.toUpperCase() as any
      );

      res.status(200).json({
        success: true,
        data: routine,
        hasOpenRoutine: !!routine,
      } as any);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Endpoint Consolidado - Todas as Rotinas Abertas
  // Otimização: 1 request ao invés de 4 paralelas
  // ==========================================

  static async getAllOpenRoutines(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.query.babyId as string, 10);

      if (!babyId) {
        throw AppError.badRequest('babyId é obrigatório');
      }

      // Verificar acesso ao bebê (cuidador ou profissional)
      const hasAccess = await hasBabyAccess(req.user.userId, babyId);
      if (!hasAccess) {
        throw AppError.forbidden('Você não tem acesso a este bebê');
      }

      const openRoutines = await RoutineService.getAllOpenRoutinesByBaby(babyId);

      res.status(200).json({
        success: true,
        data: openRoutines,
        hasAnyOpen: !!(openRoutines.feeding || openRoutines.sleep || openRoutines.bath || openRoutines.extraction),
      } as any);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Extração de Leite - Com timer
  // ==========================================

  static async startExtraction(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.startRoutine(caregiverId, babyId, 'MILK_EXTRACTION', meta, notes);

      res.status(201).json({
        success: true,
        message: 'Extração iniciada',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async closeExtraction(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.closeRoutine(caregiverId, babyId, 'MILK_EXTRACTION', meta, notes);

      res.status(200).json({
        success: true,
        message: 'Extração finalizada',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOpenExtraction(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.query.babyId as string, 10);
      const routine = await RoutineService.getOpenRoutine(caregiverId, babyId, 'MILK_EXTRACTION');

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Rotinas Instantâneas
  // ==========================================

  static async registerDiaper(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.registerInstantRoutine(
        caregiverId, babyId, 'DIAPER', meta, notes
      );

      res.status(201).json({
        success: true,
        message: 'Fralda registrada',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async registerExtraction(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const { babyId, meta, notes } = req.body;
      const routine = await RoutineService.registerInstantRoutine(
        caregiverId, babyId, 'MILK_EXTRACTION', meta, notes
      );

      res.status(201).json({
        success: true,
        message: 'Extração registrada',
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Rotas de Compatibilidade (Active/:babyId)
  // ==========================================

  static async getActiveFeeding(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.params.babyId, 10);
      const routine = await RoutineService.getOpenRoutine(caregiverId, babyId, 'FEEDING');

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getActiveSleep(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.params.babyId, 10);
      const routine = await RoutineService.getOpenRoutine(caregiverId, babyId, 'SLEEP');

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getActiveBath(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.params.babyId, 10);
      const routine = await RoutineService.getOpenRoutine(caregiverId, babyId, 'BATH');

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getActiveExtraction(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await RoutineController.getCaregiverId(req.user.userId);
      const babyId = parseInt(req.params.babyId, 10);
      const routine = await RoutineService.getOpenRoutine(caregiverId, babyId, 'MILK_EXTRACTION');

      res.status(200).json({
        success: true,
        data: routine,
      });
    } catch (error) {
      next(error);
    }
  }
}
