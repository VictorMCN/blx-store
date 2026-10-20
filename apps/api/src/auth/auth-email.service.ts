import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class AuthEmailService {
  private readonly logger =
    new Logger(
      AuthEmailService.name,
    );

  private readonly deliveryEnabled =
    process.env.EMAIL_DELIVERY_ENABLED
      ?.trim()
      .toLowerCase() === 'true';

  private readonly resend =
    process.env.RESEND_API_KEY
      ? new Resend(
          process.env.RESEND_API_KEY,
        )
      : null;

  private readonly from =
    process.env.EMAIL_FROM?.trim() ??
    '';

  private readonly appUrl = (
    process.env.APP_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  isVerificationRequired(): boolean {
    return (
      process.env.NODE_ENV !==
        'test' &&
      this.deliveryEnabled
    );
  }

  async sendVerificationEmail({
    email,
    fullName,
    token,
  }: {
    email: string;
    fullName: string;
    token: string;
  }): Promise<boolean> {
    if (
      !this.deliveryEnabled
    ) {
      return false;
    }

    if (
      !this.resend ||
      !this.from
    ) {
      this.logger.error(
        'Email verification is enabled, but Resend configuration is incomplete.',
      );

      return false;
    }

    const verificationUrl =
      `${this.appUrl}/api/auth/verify-email?token=${encodeURIComponent(
        token,
      )}`;

    try {
      const result =
        await this.resend.emails.send({
          from:
            this.from,

          to: [
            email,
          ],

          subject:
            'Verify your BLX Store email',

          text:
            `Hello ${fullName},\n\n` +
            'Verify your BLX Store email address by opening the link below:\n\n' +
            `${verificationUrl}\n\n` +
            'This verification link expires in 30 minutes.\n\n' +
            'If you did not create a BLX Store account, you can ignore this email.',

          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#0f172a;">
              <h1 style="font-size:24px;margin-bottom:16px;">
                Verify your email
              </h1>

              <p style="line-height:1.6;">
                Hello ${this.escapeHtml(
                  fullName,
                )},
              </p>

              <p style="line-height:1.6;">
                Confirm your email address to finish setting up your BLX Store account.
              </p>

              <p style="margin:28px 0;">
                <a
                  href="${verificationUrl}"
                  style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;"
                >
                  Verify email
                </a>
              </p>

              <p style="font-size:13px;line-height:1.6;color:#64748b;">
                This link expires in 30 minutes.
              </p>

              <p style="font-size:13px;line-height:1.6;color:#64748b;">
                If you did not create a BLX Store account, you can ignore this email.
              </p>
            </div>
          `,
        });

      if (result.error) {
        this.logger.error(
          `Could not send verification email: ${result.error.message}`,
        );

        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        'Could not send verification email.',
        error instanceof Error
          ? error.stack
          : undefined,
      );

      return false;
    }
  }

  private escapeHtml(
    value: string,
  ): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
