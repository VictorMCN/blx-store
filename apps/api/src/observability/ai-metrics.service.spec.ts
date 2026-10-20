import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { AssistantToolsService } from '../assistant/assistant-tools.service.js';
import { AssistantService } from '../assistant/assistant.service.js';
import {
  AiMetricsReporter,
  consumeAiMetrics,
  recordAssistantChat,
  recordOpenAiCall,
} from './ai-metrics.service.js';

describe('AI metrics', () => {
  beforeEach(() => {
    consumeAiMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consumeAiMetrics();
  });

  it('counts direct catalog and OpenAI replies separately', () => {
    recordAssistantChat('catalog', 'success', 10);
    recordAssistantChat('openai', 'success', 150);
    recordAssistantChat('openai', 'incomplete', 400);
    recordAssistantChat('openai', 'failure', 20);

    expect(consumeAiMetrics()).toMatchObject({
      chats: 4,
      directCatalogReplies: 1,
      openAiReplies: 1,
      incompleteReplies: 1,
      failedChats: 1,
      averageChatDurationMs: 145,
      maxChatDurationMs: 400,
    });
  });

  it('counts tokens across API calls and tracks fallbacks', () => {
    recordOpenAiCall('rate_limit', false, 25);
    recordOpenAiCall('success', true, 120, {
      input_tokens: 340,
      output_tokens: 55,
    });
    recordOpenAiCall('success', true, 80, {
      input_tokens: 120,
      output_tokens: 25,
    });
    recordOpenAiCall('error', false, 50);

    expect(consumeAiMetrics()).toMatchObject({
      apiCalls: 4,
      successfulApiCalls: 2,
      failedApiCalls: 1,
      rateLimitedApiCalls: 1,
      fallbackCalls: 2,
      successfulFallbackCalls: 2,
      responsesWithUsage: 2,
      inputTokens: 460,
      outputTokens: 80,
      averageApiDurationMs: 68.75,
      maxApiDurationMs: 120,
    });
  });

  it('distinguishes responses with missing usage data', () => {
    recordOpenAiCall('success', false, 35);

    expect(consumeAiMetrics()).toMatchObject({
      apiCalls: 1,
      successfulApiCalls: 1,
      responsesWithUsage: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it('returns an empty snapshot after consumption', () => {
    expect(consumeAiMetrics()).toBeNull();
    recordAssistantChat('catalog', 'success', 15);
    expect(consumeAiMetrics()?.chats).toBe(1);
    expect(consumeAiMetrics()).toBeNull();
  });

  it('publishes only aggregate fields, not customer messages', () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    const reporter = new AiMetricsReporter();

    reporter.reportMetrics();
    expect(logSpy).not.toHaveBeenCalled();

    recordAssistantChat('catalog', 'success', 15);
    recordOpenAiCall('success', false, 90, {
      input_tokens: 10,
      output_tokens: 8,
    });

    reporter.reportMetrics();

    expect(logSpy).toHaveBeenCalledOnce();

    const entry = JSON.parse(
      String(logSpy.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;

    expect(entry).toMatchObject({
      event: 'ai_metrics_summary',
      chats: 1,
      directCatalogReplies: 1,
      apiCalls: 1,
      inputTokens: 10,
      outputTokens: 8,
    });

    expect(Object.keys(entry)).not.toContain('message');
    expect(Object.keys(entry)).not.toContain('userId');
    expect(Object.keys(entry)).not.toContain('history');
    expect(consumeAiMetrics()).toBeNull();
  });

  it('tracks a real rate-limit fallback without making network calls', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({
        output: [],
        output_text: 'The second model answered.',
        usage: { input_tokens: 70, output_tokens: 20 },
      });

    const tools = {
      searchProducts: vi.fn(),
    } as unknown as AssistantToolsService;

    const service = new AssistantService(tools);

    Object.defineProperty(service, 'client', {
      value: { responses: { create } },
    });

    const result = await service.chat('test-user', {
      message: 'Compare laptops for work.',
      history: [],
    });

    expect(result.message).toBe('The second model answered.');
    expect(create).toHaveBeenCalledTimes(2);

    expect(consumeAiMetrics()).toMatchObject({
      chats: 1,
      openAiReplies: 1,
      apiCalls: 2,
      rateLimitedApiCalls: 1,
      fallbackCalls: 1,
      successfulFallbackCalls: 1,
      inputTokens: 70,
      outputTokens: 20,
    });
  });

  it('records direct catalog replies from the existing assistant', async () => {
    const searchProducts = vi.fn().mockResolvedValue({
      interpretedSearchTerms: ['headphones'],
      products: [{
        name: 'BLX Pulse ANC',
        currency: 'BRL',
        priceInCents: 89900,
        inStock: true,
        productUrl: '/products/blx-pulse-anc',
      }],
    });

    const tools = {
      searchProducts,
    } as unknown as AssistantToolsService;

    const service = new AssistantService(tools);

    await service.chat('test-user', {
      message: 'Quais fones vocês têm?',
      history: [],
    });

    expect(consumeAiMetrics()).toMatchObject({
      chats: 1,
      directCatalogReplies: 1,
      openAiReplies: 0,
      apiCalls: 0,
    });
  });
});
