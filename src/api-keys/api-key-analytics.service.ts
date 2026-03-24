import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';

export interface UsageLogEntry {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiKeyAnalyticsSummary {
  totalRequests: number;
  uniqueEndpoints: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: EndpointUsage[];
  requestsByDay: DailyRequestCount[];
  requestsByHour: HourlyRequestCount[];
}

export interface EndpointUsage {
  endpoint: string;
  method: string;
  count: number;
  averageResponseTime: number;
  errorCount: number;
}

export interface DailyRequestCount {
  date: string;
  count: number;
}

export interface HourlyRequestCount {
  hour: number;
  count: number;
}

export interface ApiKeyUsageReport {
  apiKeyId: string;
  apiKeyName: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: ApiKeyAnalyticsSummary;
}

@Injectable()
export class ApiKeyAnalyticsService {
  private readonly logger = new Logger(ApiKeyAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an API key usage event
   */
  async logUsage(entry: UsageLogEntry): Promise<void> {
    try {
      await this.prisma.apiKeyUsageLog.create({
        data: {
          apiKeyId: entry.apiKeyId,
          endpoint: entry.endpoint,
          method: entry.method,
          statusCode: entry.statusCode,
          responseTime: entry.responseTime,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log API key usage: ${error.message}`);
      // Don't throw - usage logging should not break the request
    }
  }

  /**
   * Get analytics summary for a specific API key
   */
  async getAnalyticsSummary(apiKeyId: string, startDate: Date, endDate: Date): Promise<ApiKeyAnalyticsSummary> {
    const logs = await this.prisma.apiKeyUsageLog.findMany({
      where: {
        apiKeyId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        endpoint: true,
        method: true,
        statusCode: true,
        responseTime: true,
        createdAt: true,
      },
    });

    const totalRequests = logs.length;
    const errorCount = logs.filter(l => l.statusCode >= 400).length;
    const totalResponseTime = logs.reduce((sum, l) => sum + l.responseTime, 0);

    // Group by endpoint
    const endpointMap = new Map<string, { count: number; responseTime: number; errors: number }>();
    for (const log of logs) {
      const key = `${log.method} ${log.endpoint}`;
      const existing = endpointMap.get(key) || { count: 0, responseTime: 0, errors: 0 };
      existing.count++;
      existing.responseTime += log.responseTime;
      if (log.statusCode >= 400) {
        existing.errors++;
      }
      endpointMap.set(key, existing);
    }

    const topEndpoints: EndpointUsage[] = Array.from(endpointMap.entries())
      .map(([key, data]) => {
        const [method, endpoint] = key.split(' ', 2);
        return {
          endpoint,
          method,
          count: data.count,
          averageResponseTime: Math.round(data.responseTime / data.count),
          errorCount: data.errors,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Group by day
    const dayMap = new Map<string, number>();
    for (const log of logs) {
      const day = log.createdAt.toISOString().split('T')[0];
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }

    const requestsByDay: DailyRequestCount[] = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by hour
    const hourMap = new Map<number, number>();
    for (const log of logs) {
      const hour = log.createdAt.getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    }

    const requestsByHour: HourlyRequestCount[] = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    return {
      totalRequests,
      uniqueEndpoints: endpointMap.size,
      averageResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
      errorRate: totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100) : 0,
      topEndpoints,
      requestsByDay,
      requestsByHour,
    };
  }

  /**
   * Get a full usage report for an API key
   */
  async getUsageReport(apiKeyId: string, startDate: Date, endDate: Date): Promise<ApiKeyUsageReport> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { id: true, name: true },
    });

    if (!apiKey) {
      throw new Error(`API key with ID ${apiKeyId} not found`);
    }

    const summary = await this.getAnalyticsSummary(apiKeyId, startDate, endDate);

    return {
      apiKeyId: apiKey.id,
      apiKeyName: apiKey.name,
      period: { start: startDate, end: endDate },
      summary,
    };
  }

  /**
   * Get analytics for all API keys (admin view)
   */
  async getAllKeysAnalytics(startDate: Date, endDate: Date): Promise<ApiKeyUsageReport[]> {
    const apiKeys = await this.prisma.apiKey.findMany({
      select: { id: true, name: true },
    });

    const reports: ApiKeyUsageReport[] = [];
    for (const apiKey of apiKeys) {
      const summary = await this.getAnalyticsSummary(apiKey.id, startDate, endDate);
      if (summary.totalRequests > 0) {
        reports.push({
          apiKeyId: apiKey.id,
          apiKeyName: apiKey.name,
          period: { start: startDate, end: endDate },
          summary,
        });
      }
    }

    return reports.sort((a, b) => b.summary.totalRequests - a.summary.totalRequests);
  }

  /**
   * Clean up old usage logs (data retention)
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.apiKeyUsageLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old API key usage logs`);
    return result.count;
  }

  /**
   * Get usage statistics for a specific endpoint
   */
  async getEndpointStats(
    endpoint: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topApiKeys: { apiKeyId: string; apiKeyName: string; count: number }[];
  }> {
    const logs = await this.prisma.apiKeyUsageLog.findMany({
      where: {
        endpoint,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        apiKey: {
          select: { id: true, name: true },
        },
      },
    });

    const totalRequests = logs.length;
    const errorCount = logs.filter(l => l.statusCode >= 400).length;
    const totalResponseTime = logs.reduce((sum, l) => sum + l.responseTime, 0);

    // Group by API key
    const keyMap = new Map<string, { name: string; count: number }>();
    for (const log of logs) {
      const existing = keyMap.get(log.apiKeyId) || { name: log.apiKey.name, count: 0 };
      existing.count++;
      keyMap.set(log.apiKeyId, existing);
    }

    const topApiKeys = Array.from(keyMap.entries())
      .map(([apiKeyId, data]) => ({ apiKeyId, apiKeyName: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      averageResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
      errorRate: totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100) : 0,
      topApiKeys,
    };
  }
}
