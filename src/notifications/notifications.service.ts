import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
    metadata?: any,
  ) {
    // 1. Save to database
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        metadata: metadata || {},
      },
    });

    // 2. Try real-time delivery
    // FCM Push Integration
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
    if (user?.fcmToken) {
      console.log(Sending FCM notification to token: \);
      // In production, use admin.messaging().send() here
    }
    const delivered = this.gateway.sendToUser(userId, 'notification', notification);

    if (delivered) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'DELIVERED' },
      });
    }

    return notification;
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  async deliverPending(userId: string) {
    const pending = await this.prisma.notification.findMany({
      where: { userId, status: 'PENDING' },
    });

    for (const notification of pending) {
      const delivered = this.gateway.sendToUser(userId, 'notification', notification);
      if (delivered) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'DELIVERED' },
        });
      }
    }
  }
}
