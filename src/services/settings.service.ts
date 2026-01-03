// Olive Baby API - Settings Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';

interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  routineNotifications: {
    feeding: boolean;
    sleep: boolean;
    diaper: boolean;
    bath: boolean;
    extraction: boolean;
  };
}

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
}

interface UserSettingsResponse {
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
}

// Default settings
const DEFAULT_SETTINGS = {
  pushEnabled: true,
  emailEnabled: false,
  soundEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  routineNotifications: {
    feeding: true,
    sleep: true,
    diaper: false,
    bath: true,
    extraction: false,
  },
  theme: 'system',
  language: 'pt-BR',
};

export class SettingsService {
  static async getSettings(userId: number): Promise<UserSettingsResponse> {
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId,
          routineNotifications: DEFAULT_SETTINGS.routineNotifications,
        },
      });
    }

    return {
      notifications: {
        pushEnabled: settings.pushEnabled,
        emailEnabled: settings.emailEnabled,
        soundEnabled: settings.soundEnabled,
        quietHoursEnabled: settings.quietHoursEnabled,
        quietHoursStart: settings.quietHoursStart,
        quietHoursEnd: settings.quietHoursEnd,
        routineNotifications: settings.routineNotifications as NotificationSettings['routineNotifications'],
      },
      appearance: {
        theme: settings.theme as 'light' | 'dark' | 'system',
        language: settings.language,
      },
    };
  }

  static async updateNotifications(
    userId: number,
    data: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    // Get current settings or create default
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId,
          ...data,
          routineNotifications: data.routineNotifications || DEFAULT_SETTINGS.routineNotifications,
        },
      });
    } else {
      // Merge routine notifications if provided
      const routineNotifications = data.routineNotifications
        ? { ...(settings.routineNotifications as object), ...data.routineNotifications }
        : (settings.routineNotifications as object);

      settings = await prisma.userSettings.update({
        where: { userId },
        data: {
          pushEnabled: data.pushEnabled ?? settings.pushEnabled,
          emailEnabled: data.emailEnabled ?? settings.emailEnabled,
          soundEnabled: data.soundEnabled ?? settings.soundEnabled,
          quietHoursEnabled: data.quietHoursEnabled ?? settings.quietHoursEnabled,
          quietHoursStart: data.quietHoursStart ?? settings.quietHoursStart,
          quietHoursEnd: data.quietHoursEnd ?? settings.quietHoursEnd,
          routineNotifications: routineNotifications as any,
        },
      });
    }

    return {
      pushEnabled: settings.pushEnabled,
      emailEnabled: settings.emailEnabled,
      soundEnabled: settings.soundEnabled,
      quietHoursEnabled: settings.quietHoursEnabled,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
      routineNotifications: settings.routineNotifications as NotificationSettings['routineNotifications'],
    };
  }

  static async updateAppearance(
    userId: number,
    data: Partial<AppearanceSettings>
  ): Promise<AppearanceSettings> {
    // Validate theme
    if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) {
      throw AppError.badRequest('Tema inválido. Use: light, dark ou system');
    }

    // Get current settings or create default
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId,
          theme: data.theme || DEFAULT_SETTINGS.theme,
          language: data.language || DEFAULT_SETTINGS.language,
          routineNotifications: DEFAULT_SETTINGS.routineNotifications,
        },
      });
    } else {
      settings = await prisma.userSettings.update({
        where: { userId },
        data: {
          theme: data.theme ?? settings.theme,
          language: data.language ?? settings.language,
        },
      });
    }

    return {
      theme: settings.theme as 'light' | 'dark' | 'system',
      language: settings.language,
    };
  }
}

