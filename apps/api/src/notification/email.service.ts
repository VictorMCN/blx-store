import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { Resend } from 'resend';
import { PrismaService } from '../database/prisma.service.js';
import type { OrderStatus } from '../generated/prisma/enums.js';

type FulfillmentEmailStatus =
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED';

const PAID_ORDER_STATUSES: OrderStatus[] = [
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

@Injectable()
export class EmailService {
  private readonly logger =
    new Logger(EmailService.name);

  private readonly deliveryEnabled =
    process.env.EMAIL_DELIVERY_ENABLED
      ?.trim()
      .toLowerCase() === 'true' &&
    process.env.NODE_ENV !== 'test';

  private readonly resend =
    process.env.RESEND_API_KEY
      ? new Resend(
          process.env.RESEND_API_KEY,
        )
      : null;

  private readonly fromAddress =
    process.env.EMAIL_FROM?.trim() ??
    '';

  private readonly appUrl = (
    process.env.APP_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '');

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async sendOrderConfirmed(
    orderId: string,
  ): Promise<void> {
    const order =
      await this.getOrder(
        orderId,
      );

    if (!order) {
      return;
    }

    if (
      !PAID_ORDER_STATUSES.includes(
        order.status,
      )
    ) {
      return;
    }

    await this.send({
      to:
        order.customerEmail,
      subject:
        `Order ${order.orderNumber} confirmed`,
      idempotencyKey:
        `order-${order.id}-confirmed`,
      html:
        this.buildOrderEmail({
          order,
          title:
            'Your order is confirmed',
          message:
            'Your payment was confirmed successfully. We are now preparing your order for fulfillment.',
          accentLabel:
            'Payment confirmed',
        }),
    });
  }

  async sendOrderConfirmedForPaymentIntent(
    providerPaymentIntentId:
      string,
  ): Promise<void> {
    const payment =
      await this.prisma.payment.findUnique({
        where: {
          providerPaymentIntentId,
        },
        select: {
          status: true,
          orderId: true,
          order: {
            select: {
              status: true,
            },
          },
        },
      });

    if (
      !payment ||
      payment.status !==
        'SUCCEEDED' ||
      !PAID_ORDER_STATUSES.includes(
        payment.order.status,
      )
    ) {
      return;
    }

    await this.sendOrderConfirmed(
      payment.orderId,
    );
  }

  async sendFulfillmentUpdate(
    orderId: string,
    status:
      FulfillmentEmailStatus,
  ): Promise<void> {
    const order =
      await this.getOrder(
        orderId,
      );

    if (!order) {
      return;
    }

    const template =
      this.getFulfillmentTemplate(
        status,
      );

    await this.send({
      to:
        order.customerEmail,
      subject:
        `${template.subjectPrefix} ${order.orderNumber}`,
      idempotencyKey:
        `order-${order.id}-${status.toLowerCase()}`,
      html:
        this.buildOrderEmail({
          order,
          title:
            template.title,
          message:
            template.message,
          accentLabel:
            template.accentLabel,
        }),
    });
  }

  private async getOrder(
    orderId: string,
  ) {
    return this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerName: true,
        customerEmail: true,
        currency: true,
        subtotalInCents: true,
        shippingInCents: true,
        totalInCents: true,

        items: {
          select: {
            productName: true,
            quantity: true,
            unitPriceInCents:
              true,
            lineTotalInCents:
              true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  private getFulfillmentTemplate(
    status:
      FulfillmentEmailStatus,
  ) {
    switch (status) {
      case 'PROCESSING':
        return {
          subjectPrefix:
            'We are preparing',
          title:
            'Your order is being prepared',
          message:
            'Your order has entered processing and our fulfillment team is preparing the items.',
          accentLabel:
            'Preparing order',
        };

      case 'SHIPPED':
        return {
          subjectPrefix:
            'Your order has shipped:',
          title:
            'Your order is on the way',
          message:
            'Your order has been marked as shipped and is moving through the delivery process.',
          accentLabel:
            'Shipped',
        };

      case 'DELIVERED':
        return {
          subjectPrefix:
            'Order delivered:',
          title:
            'Your order was delivered',
          message:
            'Your order has been marked as delivered. Thank you for shopping with BLX Store.',
          accentLabel:
            'Delivered',
        };
    }
  }

  private async send({
    to,
    subject,
    html,
    idempotencyKey,
  }: {
    to: string;
    subject: string;
    html: string;
    idempotencyKey: string;
  }): Promise<void> {
    if (
      !this.deliveryEnabled
    ) {
      return;
    }

    if (
      !this.resend ||
      !this.fromAddress
    ) {
      this.logger.warn(
        'Email delivery is enabled, but Resend configuration is incomplete.',
      );

      return;
    }

    try {
      const {
        error,
      } =
        await this.resend.emails.send(
          {
            from:
              this.fromAddress,
            to: [to],
            subject,
            html,
          },
          {
            idempotencyKey,
          },
        );

      if (error) {
        this.logger.error(
          `Transactional email failed: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Transactional email provider request failed.',
        error instanceof Error
          ? error.stack
          : undefined,
      );
    }
  }

  private buildOrderEmail({
    order,
    title,
    message,
    accentLabel,
  }: {
    order: Awaited<
      ReturnType<
        EmailService['getOrder']
      >
    > extends infer T
      ? Exclude<T, null>
      : never;
    title: string;
    message: string;
    accentLabel: string;
  }): string {
    const customerName =
      this.escapeHtml(
        order.customerName,
      );

    const orderNumber =
      this.escapeHtml(
        order.orderNumber,
      );

    const itemsHtml =
      order.items
        .map(
          (item) => `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;">
                ${this.escapeHtml(item.productName)}

                <div style="margin-top:4px;font-size:12px;color:#64748b;">
                  Quantity: ${item.quantity}
                </div>
              </td>

              <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:600;">
                ${this.formatMoney(
                  item.lineTotalInCents,
                  order.currency,
                )}
              </td>
            </tr>
          `,
        )
        .join('');

    const orderUrl =
      `${this.appUrl}/account/orders/${order.id}`;

    return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;background:#0f172a;color:#ffffff;">
                <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                  BLX
                </div>

                <div style="margin-top:4px;font-size:13px;color:#cbd5e1;">
                  Store transactional update
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;">
                <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700;">
                  ${this.escapeHtml(accentLabel)}
                </div>

                <h1 style="margin:20px 0 12px;font-size:26px;line-height:1.2;color:#0f172a;">
                  ${this.escapeHtml(title)}
                </h1>

                <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">
                  Hello ${customerName},
                </p>

                <p style="margin:12px 0 0;color:#475569;font-size:15px;line-height:1.7;">
                  ${this.escapeHtml(message)}
                </p>

                <div style="margin:28px 0 0;padding:18px;background:#f8fafc;border-radius:12px;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">
                    Order
                  </div>

                  <div style="margin-top:6px;font-size:17px;font-weight:700;color:#0f172a;">
                    ${orderNumber}
                  </div>
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
                  ${itemsHtml}

                  <tr>
                    <td style="padding-top:18px;color:#64748b;">
                      Subtotal
                    </td>

                    <td style="padding-top:18px;text-align:right;color:#0f172a;">
                      ${this.formatMoney(
                        order.subtotalInCents,
                        order.currency,
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding-top:8px;color:#64748b;">
                      Shipping
                    </td>

                    <td style="padding-top:8px;text-align:right;color:#0f172a;">
                      ${this.formatMoney(
                        order.shippingInCents,
                        order.currency,
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding-top:12px;font-weight:700;color:#0f172a;">
                      Total
                    </td>

                    <td style="padding-top:12px;text-align:right;font-size:18px;font-weight:800;color:#0f172a;">
                      ${this.formatMoney(
                        order.totalInCents,
                        order.currency,
                      )}
                    </td>
                  </tr>
                </table>

                <div style="margin-top:30px;">
                  <a
                    href="${this.escapeHtml(orderUrl)}"
                    style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;"
                  >
                    View order
                  </a>
                </div>

                <p style="margin:30px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
                  This message was generated automatically by BLX Store.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim();
  }

  private formatMoney(
    amountInCents: number,
    currency: string,
  ): string {
    return new Intl.NumberFormat(
      'en-US',
      {
        style:
          'currency',
        currency,
      },
    ).format(
      amountInCents /
        100,
    );
  }

  private escapeHtml(
    value: string,
  ): string {
    return value
      .replaceAll(
        '&',
        '&amp;',
      )
      .replaceAll(
        '<',
        '&lt;',
      )
      .replaceAll(
        '>',
        '&gt;',
      )
      .replaceAll(
        '"',
        '&quot;',
      )
      .replaceAll(
        "'",
        '&#039;',
      );
  }
}
