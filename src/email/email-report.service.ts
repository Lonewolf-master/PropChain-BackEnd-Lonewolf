import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailReportService {
  constructor(private readonly prisma: PrismaService) {}

  async recordDelivery(emailId: string, status: 'delivered' | 'bounced' | 'opened' | 'clicked') {
    return this.prisma.emailReport.create({
      data: {
        emailId,
        delivered: status === 'delivered',
        bounced: status === 'bounced',
        opened: status === 'opened',
        clicked: status === 'clicked',
      },
    });
  }

  async getMetrics() {
    const total = await this.prisma.emailReport.count();
    const delivered = await this.prisma.emailReport.count({ where: { delivered: true } });
    const bounced = await this.prisma.emailReport.count({ where: { bounced: true } });
    const opened = await this.prisma.emailReport.count({ where: { opened: true } });
    const clicked = await this.prisma.emailReport.count({ where: { clicked: true } });

    return {
      deliveryRate: delivered / total,
      bounceRate: bounced / total,
      openRate: opened / total,
      clickRate: clicked / total,
    };
  }
}
