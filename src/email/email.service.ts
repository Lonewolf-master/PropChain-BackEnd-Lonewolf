import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  userId?: string;
  emailType?: string;
}

export interface FraudAlertEmailPayload {
  alertId: string;
  pattern: string;
  severity: string;
  title: string;
  description: string;
  userEmail?: string | null;
}

import { PrismaService } from '../database/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly trackingService: TrackingService,
  ) {}

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}`;

    const emailOptions: EmailOptions = {
      to: email,
      subject: 'Password Reset - PropChain',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You have requested to reset your password for your PropChain account.</p>
          <p>Please click the link below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Reset Password
          </a>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>Best regards,<br>The PropChain Team</p>
        </div>
      `,
      text: `
        Password Reset Request

        You have requested to reset your password for your PropChain account.

        Please use the following link to reset your password:
        ${resetUrl}

        If you didn't request this password reset, please ignore this email.

        This link will expire in 1 hour for security reasons.

        Best regards,
        The PropChain Team
      `,
    };

    await this.sendEmail(emailOptions);
  }

  async sendAccountLockedEmail(email: string, lockoutDuration: number): Promise<void> {
    const emailOptions: EmailOptions = {
      to: email,
      subject: 'Account Locked - PropChain',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d9534f;">Account Locked</h2>
          <p>Your PropChain account has been temporarily locked due to multiple failed login attempts.</p>
          <p>The lockout will automatically expire in ${lockoutDuration} minutes.</p>
          <p>If you did not attempt to log in, please reset your password immediately or contact our support team.</p>
          <p>Best regards,<br>The PropChain Team</p>
        </div>
      `,
      text: `
        Account Locked

        Your PropChain account has been temporarily locked due to multiple failed login attempts.

        The lockout will automatically expire in ${lockoutDuration} minutes.

        If you did not attempt to log in, please reset your password immediately or contact our support team.

        Best regards,
        The PropChain Team
      `,
    };

    await this.sendEmail(emailOptions);
  }

  async sendFraudAlertEmail(recipients: string[], payload: FraudAlertEmailPayload): Promise<void> {
    await Promise.all(
      recipients.map((recipient) =>
        this.sendEmail({
          to: recipient,
          subject: `[Fraud Alert][${payload.severity}] ${payload.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #d9534f;">Fraud Alert Triggered</h2>
              <p><strong>Alert ID:</strong> ${payload.alertId}</p>
              <p><strong>Pattern:</strong> ${payload.pattern}</p>
              <p><strong>Severity:</strong> ${payload.severity}</p>
              <p><strong>User:</strong> ${payload.userEmail ?? 'Unknown'}</p>
              <p><strong>Summary:</strong> ${payload.description}</p>
            </div>
          `,
          text: `
Fraud Alert Triggered

Alert ID: ${payload.alertId}
Pattern: ${payload.pattern}
Severity: ${payload.severity}
User: ${payload.userEmail ?? 'Unknown'}
Summary: ${payload.description}
          `.trim(),
        }),
      ),
    );
  }

  async handleBounce(
    email: string,
    type: 'HARD' | 'SOFT',
    reason?: string,
    rawEvent?: any,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    await this.prisma.emailBounce.create({
      data: {
        userId: user.id,
        email,
        bounceType: type,
        reason,
        rawEvent,
      },
    });

    if (type === 'HARD') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailStatus: 'INVALID' },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailStatus: 'BOUNCED' },
      });
    }
  }

  private async sendEmail(options: EmailOptions): Promise<void> {
    const baseUrl = this.configService.get<string>('API_URL', 'http://localhost:3000/api');
    let html = options.html;

    // 1. Check if user is blocked or has invalid email
    if (options.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: options.userId } });
      if (user && (user.isBlocked || user.emailStatus === 'INVALID')) {
        console.log(`🚫 Skipping email to ${options.to} (User blocked or email invalid)`);
        return;
      }
    }

    // 2. Click Tracking: Rewrite links
    if (options.userId) {
      const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi;
      html = html.replace(linkRegex, (match, url, rest) => {
        // Only track external links or specific ones if needed
        if (url.startsWith('http')) {
          const trackingUrl = `${baseUrl}/track/click?url=${encodeURIComponent(url)}&userId=${options.userId}`;
          return `<a href="${trackingUrl}"${rest}>`;
        }
        return match;
      });
    }

    // 3. Open Tracking: Inject pixel
    if (options.userId && options.emailType) {
      const trackingId = uuidv4();
      await this.trackingService.createEmailEngagement(
        options.userId,
        options.emailType,
        trackingId,
      );
      const pixelUrl = `${baseUrl}/track/open/${trackingId}.png`;
      html += `<img src="${pixelUrl}" width="1" height="1" style="display:none;" />`;
    }

    // For now, we'll just log the email.
    console.log('📧 Sending email:');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Tracking enabled: ${!!options.userId}`);

    // Actual implementation would go here
  }
}
