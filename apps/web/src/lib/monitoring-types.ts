export interface HttpMetricsSnapshot {
  windowStartedAt: string;
  windowEndedAt: string;
  requests: number;
  http2xx: number;
  http3xx: number;
  http4xx: number;
  http5xx: number;
  otherStatuses: number;
  averageDurationMs: number;
  maxDurationMs: number;
  p95LatencyBucket: string;
}

export interface AiMetricsSnapshot {
  windowStartedAt: string;
  windowEndedAt: string;
  chats: number;
  directCatalogReplies: number;
  openAiReplies: number;
  incompleteReplies: number;
  failedChats: number;
  maxChatDurationMs: number;
  averageChatDurationMs: number;
  apiCalls: number;
  successfulApiCalls: number;
  failedApiCalls: number;
  rateLimitedApiCalls: number;
  fallbackCalls: number;
  successfulFallbackCalls: number;
  responsesWithUsage: number;
  inputTokens: number;
  outputTokens: number;
  maxApiDurationMs: number;
  averageApiDurationMs: number;
}

export interface PaymentMetricsSnapshot {
  windowStartedAt: string;
  windowEndedAt: string;
  paymentIntentCreated: number;
  paymentIntentCreationFailed: number;
  webhookAccepted: number;
  webhookRejected: number;
  webhookProcessingFailed: number;
  paymentSucceeded: number;
  paymentFailed: number;
  paymentCanceled: number;
  reservationExpired: number;
  reservationExpirationFailed: number;
}

export interface MonitoringResponse {
  service: string;
  generatedAt: string;
  health: {
    api: "ok";
    database: "ok" | "unavailable";
  };
  retention: {
    type: "memory";
    intervalSeconds: number;
    maxSnapshotsPerCategory: number;
  };
  http: {
    history: HttpMetricsSnapshot[];
  };
  ai: {
    history: AiMetricsSnapshot[];
  };
  payments: {
    history: PaymentMetricsSnapshot[];
  };
}
