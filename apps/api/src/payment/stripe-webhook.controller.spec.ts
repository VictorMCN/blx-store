import {
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { EmailService } from '../notification/email.service.js';
import { consumePaymentMetrics } from '../observability/payment-metrics.service.js';
import type { PaymentService } from './payment.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import type { StripeService } from './stripe.service.js';

describe('StripeWebhookController metrics', () => {
  const constructWebhookEvent = vi.fn();
  const handleStripeWebhook = vi.fn();
  const sendOrderConfirmedForPaymentIntent = vi.fn();

  const controller = new StripeWebhookController(
    {
      constructWebhookEvent,
    } as unknown as StripeService,
    {
      handleStripeWebhook,
    } as unknown as PaymentService,
    {
      sendOrderConfirmedForPaymentIntent,
    } as unknown as EmailService,
  );

  const request = {
    rawBody: Buffer.from('{}'),
  } as unknown as RawBodyRequest<Request>;

  function createEvent(
    type:
      | 'payment_intent.succeeded'
      | 'payment_intent.payment_failed'
      | 'payment_intent.canceled',
  ): Stripe.Event {
    return {
      type,
      data: {
        object: {
          id: 'pi_test_payment',
        },
      },
    } as unknown as Stripe.Event;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    consumePaymentMetrics();

    handleStripeWebhook.mockResolvedValue(undefined);
    sendOrderConfirmedForPaymentIntent.mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => {
    consumePaymentMetrics();
  });

  it('counts a webhook with a missing signature as rejected', async () => {
    await expect(
      controller.handleWebhook(request, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(consumePaymentMetrics()).toMatchObject({
      webhookRejected: 1,
      webhookAccepted: 0,
    });

    expect(constructWebhookEvent).not.toHaveBeenCalled();
  });

  it('counts a missing raw body as rejected', async () => {
    const emptyRequest =
      {} as RawBodyRequest<Request>;

    await expect(
      controller.handleWebhook(
        emptyRequest,
        'valid_signature',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(consumePaymentMetrics()).toMatchObject({
      webhookRejected: 1,
    });
  });

  it('counts rejected signatures without processing events', async () => {
    constructWebhookEvent.mockImplementation(() => {
      throw new BadRequestException(
        'Invalid webhook signature.',
      );
    });

    await expect(
      controller.handleWebhook(
        request,
        'invalid_signature',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(consumePaymentMetrics()).toMatchObject({
      webhookRejected: 1,
      webhookAccepted: 0,
    });

    expect(handleStripeWebhook).not.toHaveBeenCalled();
  });

  it('counts successfully processed payment events', async () => {
    const event = createEvent(
      'payment_intent.succeeded',
    );

    constructWebhookEvent.mockReturnValue(event);

    await expect(
      controller.handleWebhook(
        request,
        'valid_signature',
      ),
    ).resolves.toEqual({
      received: true,
    });

    expect(handleStripeWebhook).toHaveBeenCalledWith(
      event,
    );

    expect(
      sendOrderConfirmedForPaymentIntent,
    ).toHaveBeenCalledWith('pi_test_payment');

    expect(consumePaymentMetrics()).toMatchObject({
      webhookAccepted: 1,
      paymentSucceeded: 1,
      webhookProcessingFailed: 0,
    });
  });

  it('counts failed-payment event deliveries', async () => {
    constructWebhookEvent.mockReturnValue(
      createEvent('payment_intent.payment_failed'),
    );

    await controller.handleWebhook(
      request,
      'valid_signature',
    );

    expect(consumePaymentMetrics()).toMatchObject({
      webhookAccepted: 1,
      paymentFailed: 1,
      paymentSucceeded: 0,
    });

    expect(
      sendOrderConfirmedForPaymentIntent,
    ).not.toHaveBeenCalled();
  });

  it('counts canceled-payment event deliveries', async () => {
    constructWebhookEvent.mockReturnValue(
      createEvent('payment_intent.canceled'),
    );

    await controller.handleWebhook(
      request,
      'valid_signature',
    );

    expect(consumePaymentMetrics()).toMatchObject({
      webhookAccepted: 1,
      paymentCanceled: 1,
    });
  });

  it('counts errors during webhook processing', async () => {
    constructWebhookEvent.mockReturnValue(
      createEvent('payment_intent.succeeded'),
    );

    handleStripeWebhook.mockRejectedValue(
      new Error('Simulated processing error'),
    );

    await expect(
      controller.handleWebhook(
        request,
        'valid_signature',
      ),
    ).rejects.toThrow('Simulated processing error');

    expect(consumePaymentMetrics()).toMatchObject({
      webhookProcessingFailed: 1,
      webhookAccepted: 0,
      paymentSucceeded: 0,
    });

    expect(
      sendOrderConfirmedForPaymentIntent,
    ).not.toHaveBeenCalled();
  });

  it('tracks errors in confirmation handling', async () => {
    constructWebhookEvent.mockReturnValue(
      createEvent('payment_intent.succeeded'),
    );

    sendOrderConfirmedForPaymentIntent.mockRejectedValue(
      new Error('Simulated email failure'),
    );

    await expect(
      controller.handleWebhook(
        request,
        'valid_signature',
      ),
    ).rejects.toThrow('Simulated email failure');

    expect(consumePaymentMetrics()).toMatchObject({
      webhookProcessingFailed: 1,
      webhookAccepted: 0,
    });
  });

  it('counts duplicate deliveries as events, not unique payments', async () => {
    constructWebhookEvent.mockReturnValue(
      createEvent('payment_intent.succeeded'),
    );

    await controller.handleWebhook(
      request,
      'valid_signature',
    );

    await controller.handleWebhook(
      request,
      'valid_signature',
    );

    expect(consumePaymentMetrics()).toMatchObject({
      webhookAccepted: 2,
      paymentSucceeded: 2,
    });
  });
});
