import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiKeyService } from './api-key.service';
import { ApiKeyAnalyticsService } from './api-key-analytics.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyRotationScheduler {
  private readonly logger = new Logger(ApiKeyRotationScheduler.name);
  private readonly retentionDays: number;

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly analyticsService: ApiKeyAnalyticsService,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = this.configService.get<number>('API_KEY_LOG_RETENTION_DAYS', 90);
  }

  /**
   * Check for expired API keys and rotate them automatically
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutomaticRotation(): Promise<void> {
    this.logger.log('Starting automatic API key rotation check...');

    try {
      const results = await this.apiKeyService.autoRotateExpiredKeys();

      if (results.length > 0) {
        this.logger.log(`Automatically rotated ${results.length} API key(s)`);
        results.forEach(result => {
          this.logger.log(`  - ${result.name}: ${result.oldKeyPrefix} -> ${result.newKeyPrefix}`);
        });
      } else {
        this.logger.log('No API keys required automatic rotation');
      }
    } catch (error) {
      this.logger.error(`Automatic rotation failed: ${error.message}`);
    }
  }

  /**
   * Check for keys approaching rotation and log warnings
   * Runs daily at 6 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleRotationWarnings(): Promise<void> {
    this.logger.log('Checking for API keys approaching rotation...');

    try {
      const approachingKeys = await this.apiKeyService.getKeysApproachingRotation();

      if (approachingKeys.length > 0) {
        this.logger.warn(`${approachingKeys.length} API key(s) will require rotation soon:`);
        approachingKeys.forEach(key => {
          this.logger.warn(`  - ${key.name} (${key.keyPrefix}): ${key.daysUntilRotation} days until rotation`);
        });
      } else {
        this.logger.log('No API keys approaching rotation');
      }
    } catch (error) {
      this.logger.error(`Rotation warning check failed: ${error.message}`);
    }
  }

  /**
   * Clean up old usage logs for data retention compliance
   * Runs weekly on Sunday at 2 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async handleLogCleanup(): Promise<void> {
    this.logger.log('Starting API key usage log cleanup...');

    try {
      const deletedCount = await this.analyticsService.cleanupOldLogs(this.retentionDays);
      this.logger.log(`Cleaned up ${deletedCount} old usage log entries`);
    } catch (error) {
      this.logger.error(`Log cleanup failed: ${error.message}`);
    }
  }
}
