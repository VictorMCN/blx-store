import type {
  MonitoringResponse,
  HttpMetricsSnapshot,
} from "@/lib/monitoring-types";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sumValues<T>(
  items: T[],
  select: (item: T) => number,
): number {
  return items.reduce(
    (total, item) => total + select(item),
    0,
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function RequestChart({
  history,
}: {
  history: HttpMetricsSnapshot[];
}) {
  const recent = history.slice(-16);
  const highest = Math.max(
    1,
    ...recent.map((item) => item.requests),
  );

  if (recent.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No request samples yet. Metrics appear after the
        next reporting interval with traffic.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">
        Request volume
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Completed reporting windows with activity
      </p>
      <div
        className="mt-6 flex h-40 items-end gap-2"
        role="img"
        aria-label="Request volume across recent reporting windows"
      >
        {recent.map((item) => (
          <div
            key={item.windowEndedAt}
            className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${formatTime(item.windowEndedAt)}: ${item.requests} requests`}
          >
            <div
              className="min-h-1 w-full rounded-t-md bg-blue-500 transition-colors group-hover:bg-blue-600"
              style={{
                height: `${Math.max(
                  3,
                  (item.requests / highest) * 100,
                )}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>
          {formatTime(recent[0]!.windowEndedAt)}
        </span>
        <span>
          {formatTime(recent[recent.length - 1]!.windowEndedAt)}
        </span>
      </div>
    </div>
  );
}

export function MonitoringDashboard({
  data,
}: {
  data: MonitoringResponse;
}) {
  const http = data.http.history;
  const ai = data.ai.history;
  const payments = data.payments.history;

  const requests = sumValues(
    http,
    (item) => item.requests,
  );

  const serverErrors = sumValues(
    http,
    (item) => item.http5xx,
  );

  const weightedDuration = sumValues(
    http,
    (item) =>
      item.averageDurationMs * item.requests,
  );

  const averageDuration = requests === 0
    ? null
    : weightedDuration / requests;

  const chats = sumValues(
    ai,
    (item) => item.chats,
  );

  const inputTokens = sumValues(
    ai,
    (item) => item.inputTokens,
  );

  const outputTokens = sumValues(
    ai,
    (item) => item.outputTokens,
  );

  const apiCalls = sumValues(
    ai,
    (item) => item.apiCalls,
  );

  const rateLimits = sumValues(
    ai,
    (item) => item.rateLimitedApiCalls,
  );

  const fallbacks = sumValues(
    ai,
    (item) => item.fallbackCalls,
  );

  const lastHttp = http.at(-1);

  const paymentEvents = [
    ["PaymentIntent create calls", "paymentIntentCreated"],
    ["PaymentIntent create failures", "paymentIntentCreationFailed"],
    ["Accepted webhooks", "webhookAccepted"],
    ["Rejected webhooks", "webhookRejected"],
    ["Webhook processing failures", "webhookProcessingFailed"],
    ["Success event deliveries", "paymentSucceeded"],
    ["Failure event deliveries", "paymentFailed"],
    ["Cancellation event deliveries", "paymentCanceled"],
    ["Expired reservations", "reservationExpired"],
    ["Reservation expiration failures", "reservationExpirationFailed"],
  ] as const;

  return (
    <div className="space-y-10">
      <Section
        title="Service Health"
        description="Live application and database availability"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="API"
            value="Operational"
            detail="The monitoring endpoint is responding."
          />
          <MetricCard
            label="PostgreSQL"
            value={
              data.health.database === "ok"
                ? "Connected"
                : "Unavailable"
            }
            detail={
              data.health.database === "ok"
                ? "Database health query succeeded."
                : "Database health query failed."
            }
          />
        </div>
      </Section>

      <Section
        title="HTTP Performance"
        description="Aggregated metrics from recorded reporting windows"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Requests"
            value={formatNumber(requests)}
            detail={`${http.length} recorded windows`}
          />
          <MetricCard
            label="Avg response time"
            value={
              averageDuration === null
                ? "—"
                : `${averageDuration.toFixed(1)} ms`
            }
            detail="Weighted by request count"
          />
          <MetricCard
            label="Server errors"
            value={formatNumber(serverErrors)}
            detail="HTTP 5xx responses"
          />
          <MetricCard
            label="Latest p95 bucket"
            value={lastHttp?.p95LatencyBucket ?? "—"}
            detail="Approximate latency range"
          />
        </div>
        <RequestChart history={http} />
      </Section>

      <Section
        title="AI Assistant"
        description="Usage counters without storing customer conversations"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Chat requests"
            value={formatNumber(chats)}
            detail={`${sumValues(ai, (item) => item.directCatalogReplies)} direct catalog replies`}
          />
          <MetricCard
            label="OpenAI API calls"
            value={formatNumber(apiCalls)}
            detail={`${sumValues(ai, (item) => item.openAiReplies)} completed AI replies`}
          />
          <MetricCard
            label="Reported tokens"
            value={formatNumber(
              inputTokens + outputTokens,
            )}
            detail={`${formatNumber(inputTokens)} input · ${formatNumber(outputTokens)} output`}
          />
          <MetricCard
            label="Rate limits"
            value={formatNumber(rateLimits)}
            detail="HTTP 429 responses"
          />
          <MetricCard
            label="Fallback calls"
            value={formatNumber(fallbacks)}
            detail="Alternative-model attempts"
          />
          <MetricCard
            label="Failed chats"
            value={formatNumber(
              sumValues(ai, (item) => item.failedChats),
            )}
            detail="Assistant requests that failed"
          />
        </div>
      </Section>

      <Section
        title="Payments & Reservations"
        description="Stripe event deliveries and reservation operations, not unique payment counts"
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {paymentEvents.map(([label, key]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3 last:border-b-0"
            >
              <span className="text-sm text-slate-600">
                {label}
              </span>
              <span className="font-semibold tabular-nums text-slate-950">
                {formatNumber(
                  sumValues(
                    payments,
                    (item) => item[key],
                  ),
                )}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-xs leading-relaxed text-slate-500">
        Metrics are stored in application memory and reset
        when the backend restarts. Only reporting windows
        with activity are retained, up to{" "}
        {data.retention.maxSnapshotsPerCategory} per category.
        Token figures reflect usage reported by successful
        OpenAI responses and may not equal billable usage.
      </p>
    </div>
  );
}
