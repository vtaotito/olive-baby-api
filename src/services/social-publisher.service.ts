import { env } from '../config/env';
import { logger } from '../config/logger';

export class SocialPublisherService {
  private static getHeaders() {
    return {
      'x-publora-api-key': env.PUBLORA_API_KEY || '',
      'Content-Type': 'application/json',
    };
  }

  private static getBaseUrl() {
    return env.PUBLORA_API_URL || 'https://api.publora.com';
  }

  static async listConnections(): Promise<unknown[]> {
    if (!env.PUBLORA_API_KEY) {
      logger.warn('PUBLORA_API_KEY not configured');
      return [];
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/platform-connections`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error(`Publora error: ${response.status}`);
      const data = await response.json() as { data: unknown[] };
      return data.data || [];
    } catch (error) {
      logger.error('Failed to list Publora connections', { error });
      return [];
    }
  }

  static async testConnection(platformId: string): Promise<{ success: boolean; error?: string }> {
    if (!env.PUBLORA_API_KEY) return { success: false, error: 'PUBLORA_API_KEY not configured' };

    try {
      const response = await fetch(`${this.getBaseUrl()}/test-connection/${platformId}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      return { success: response.ok };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  static async publishPost(options: {
    caption: string;
    mediaUrls?: string[];
    platformIds: string[];
    scheduledAt?: string;
  }): Promise<{ success: boolean; externalId?: string; error?: string }> {
    if (!env.PUBLORA_API_KEY) {
      return { success: false, error: 'PUBLORA_API_KEY not configured' };
    }

    try {
      const body: Record<string, unknown> = {
        content: options.caption,
        platform_ids: options.platformIds,
      };

      if (options.mediaUrls?.length) {
        body.media_urls = options.mediaUrls;
      }
      if (options.scheduledAt) {
        body.scheduled_at = options.scheduledAt;
      }

      const response = await fetch(`${this.getBaseUrl()}/create-post`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error('Publora publish error', { status: response.status, error: errText });
        return { success: false, error: `Publora error: ${response.status}` };
      }

      const data = await response.json() as { data: { id: string } };
      return { success: true, externalId: data.data?.id };
    } catch (error) {
      logger.error('Failed to publish via Publora', { error });
      return { success: false, error: (error as Error).message };
    }
  }

  static async getPostStatus(postGroupId: string): Promise<unknown> {
    if (!env.PUBLORA_API_KEY) return null;

    try {
      const response = await fetch(`${this.getBaseUrl()}/get-post/${postGroupId}`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
}
