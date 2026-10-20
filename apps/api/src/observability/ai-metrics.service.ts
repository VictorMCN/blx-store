import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

export type AiChatRoute = 'catalog' | 'openai';
export type AiChatOutcome =
  | 'success'
  | 'failure'
  | 'incomplete';
export type OpenAiCallOutcome =
  | 'success'
  | 'rate_limit'
  | 'error';

interface OpenAiUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AiMetricsWindow {
  startedAt: number;
  chats: number;
  directCatalogReplies: number;
  openAiReplies: number;
  incompleteReplies: number;
  failedChats: number;
  totalChatDurationMs: number;
  maxChatDurationMs: number;
  apiCalls: number;
  successfulApiCalls: number;
  failedApiCalls: number;
  rateLimitedApiCalls: number;
  fallbackCalls: number;
  successfulFallbackCalls: number;
  responsesWithUsage: number;
  inputTokens: number;
  outputTokens: number;
  totalApiDurationMs: number;
  maxApiDurationMs: number;
}

export interface AiMetricsSnapshot extends Omit<
  AiMetricsWindow,
  'startedAt' | 'totalChatDurationMs' | 'totalApiDurationMs'
> {
  windowStartedAt: string;
  windowEndedAt: string;
  averageChatDurationMs: number;
  averageApiDurationMs: number;
}

const HISTORY_LIMIT = 30;

function createWindow(): AiMetricsWindow {
  return {
    startedAt: Date.now(),
    chats: 0,
    directCatalogReplies: 0,
    openAiReplies: 0,
    incompleteReplies: 0,
    failedChats: 0,
    totalChatDurationMs: 0,
    maxChatDurationMs: 0,
    apiCalls: 0,
    successfulApiCalls: 0,
    failedApiCalls: 0,
    rateLimitedApiCalls: 0,
    fallbackCalls: 0,
    successfulFallbackCalls: 0,
    responsesWithUsage: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalApiDurationMs: 0,
    maxApiDurationMs: 0,
  };
}

let currentWindow = createWindow();
const recentSnapshots: AiMetricsSnapshot[] = [];

function safeDuration(durationMs: number): number {
  return Number.isFinite(durationMs)
    ? Math.max(0, durationMs)
    : 0;
}

function safeTokens(tokens: number): number {
  return Number.isSafeInteger(tokens) && tokens >= 0
    ? tokens
    : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function recordAssistantChat(
  route: AiChatRoute,
  outcome: AiChatOutcome,
  durationMs: number,
): void {
  const duration = safeDuration(durationMs);

  currentWindow.chats += 1;
  currentWindow.totalChatDurationMs += duration;
  currentWindow.maxChatDurationMs = Math.max(
    currentWindow.maxChatDurationMs,
    duration,
  );

  if (outcome === 'failure') {
    currentWindow.failedChats += 1;
  } else if (outcome === 'incomplete') {
    currentWindow.incompleteReplies += 1;
  } else if (route === 'catalog') {
    currentWindow.directCatalogReplies += 1;
  } else {
    currentWindow.openAiReplies += 1;
  }
}

export function recordOpenAiCall(
  outcome: OpenAiCallOutcome,
  isFallback: boolean,
  durationMs: number,
  usage?: OpenAiUsage | null,
): void {
  const duration = safeDuration(durationMs);

  currentWindow.apiCalls += 1;
  currentWindow.totalApiDurationMs += duration;
  currentWindow.maxApiDurationMs = Math.max(
    currentWindow.maxApiDurationMs,
    duration,
  );

  if (isFallback) {
    currentWindow.fallbackCalls += 1;
  }

  if (outcome === 'success') {
    currentWindow.successfulApiCalls += 1;

    if (isFallback) {
      currentWindow.successfulFallbackCalls += 1;
    }

    if (usage) {
      currentWindow.responsesWithUsage += 1;
      currentWindow.inputTokens += safeTokens(
        usage.input_tokens,
      );
      currentWindow.outputTokens += safeTokens(
        usage.output_tokens,
      );
    }
  } else if (outcome === 'rate_limit') {
    currentWindow.rateLimitedApiCalls += 1;
  } else {
    currentWindow.failedApiCalls += 1;
  }
}

export function consumeAiMetrics():
  AiMetricsSnapshot | null {
  if (
    currentWindow.chats === 0 &&
    currentWindow.apiCalls === 0
  ) {
    return null;
  }

  const previous = currentWindow;
  currentWindow = createWindow();

  return {
    windowStartedAt: new Date(
      previous.startedAt,
    ).toISOString(),
    windowEndedAt: new Date().toISOString(),
    chats: previous.chats,
    directCatalogReplies: previous.directCatalogReplies,
    openAiReplies: previous.openAiReplies,
    incompleteReplies: previous.incompleteReplies,
    failedChats: previous.failedChats,
    maxChatDurationMs: round(
      previous.maxChatDurationMs,
    ),
    averageChatDurationMs: previous.chats === 0
      ? 0
      : round(
          previous.totalChatDurationMs /
            previous.chats,
        ),
    apiCalls: previous.apiCalls,
    successfulApiCalls: previous.successfulApiCalls,
    failedApiCalls: previous.failedApiCalls,
    rateLimitedApiCalls: previous.rateLimitedApiCalls,
    fallbackCalls: previous.fallbackCalls,
    successfulFallbackCalls: previous.successfulFallbackCalls,
    responsesWithUsage: previous.responsesWithUsage,
    inputTokens: previous.inputTokens,
    outputTokens: previous.outputTokens,
    maxApiDurationMs: round(
      previous.maxApiDurationMs,
    ),
    averageApiDurationMs: previous.apiCalls === 0
      ? 0
      : round(
          previous.totalApiDurationMs /
            previous.apiCalls,
        ),
  };
}

export function getRecentAiMetrics():
  AiMetricsSnapshot[] {
  return recentSnapshots.map((snapshot) => ({
    ...snapshot,
  }));
}

@Injectable()
export class AiMetricsReporter {
  private readonly logger = new Logger(
    AiMetricsReporter.name,
  );

  @Interval(60_000)
  reportMetrics(): void {
    const snapshot = consumeAiMetrics();

    if (!snapshot) {
      return;
    }

    recentSnapshots.push(snapshot);

    if (recentSnapshots.length > HISTORY_LIMIT) {
      recentSnapshots.shift();
    }

    this.logger.log(
      JSON.stringify({
        event: 'ai_metrics_summary',
        ...snapshot,
      }),
    );
  }
}
