"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { ErpInventoryPanel } from "@/components/erp-inventory-panel";
import { apiFetch } from "@/lib/api";
import type {
  ErpJobsResponse,
  ErpRetryResponse,
  ErpSyncJob,
  ErpSyncStatus,
} from "@/lib/erp-types";

const REFRESH_INTERVAL_MS = 15_000;

const STATUS_STYLES: Record<
  ErpSyncStatus,
  string
> = {
  PENDING: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  RETRY: "bg-amber-50 text-amber-700",
  SYNCED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({
  status,
}: {
  status: ErpSyncStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value.toLocaleString("en-US")}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {detail}
      </p>
    </div>
  );
}

export default function AdminErpPage() {
  const [data, setData] =
    useState<ErpJobsResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [retryingJobId, setRetryingJobId] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result =
        await apiFetch<ErpJobsResponse>(
          "/api/admin/erp/jobs",
        );

      setData(result);
      setError(null);
    } catch {
      setError(
        "Unable to load ERP synchronization data. Check your administrator access and API connection.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(
      () => void refresh(),
      0,
    );

    const interval = window.setInterval(
      () => void refresh(),
      REFRESH_INTERVAL_MS,
    );

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function retryJob(job: ErpSyncJob) {
    if (retryingJobId) {
      return;
    }

    setRetryingJobId(job.id);
    setError(null);

    try {
      await apiFetch<ErpRetryResponse>(
        `/api/admin/erp/jobs/${job.id}/retry`,
        {
          method: "POST",
        },
      );

      await refresh();
    } catch {
      setError(
        "Unable to requeue this synchronization job. Refresh the page and try again.",
      );
    } finally {
      setRetryingJobId(null);
    }
  }

  const counts = data?.counts;

  const totalJobs = counts
    ? Object.values(counts).reduce(
        (total, count) => total + count,
        0,
      )
    : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Administration
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
              ERP Integration
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Monitor order exports, retry failed jobs,
              and inspect synchronization activity.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Refresh data
            </button>
          </div>
        </header>

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-sm font-semibold text-blue-900">
            Demonstration ERP Provider
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-700">
            This integration uses a local mock ERP
            provider. It demonstrates persistent jobs,
            order exports, retry handling, and
            idempotency without connecting to a
            commercial ERP service.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
          >
            {error}
          </div>
        )}

        {loading && !data && (
          <p className="mt-10 text-sm text-slate-500">
            Loading ERP synchronization data...
          </p>
        )}

        {data && (
          <div className="mt-8 space-y-10">
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-950">
                  Synchronization Overview
                </h2>

                <span className="text-xs text-slate-500">
                  Auto-refresh every 15 seconds
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryCard
                  title="Total Jobs"
                  value={totalJobs}
                  detail="All registered order export jobs"
                />

                <SummaryCard
                  title="Synced"
                  value={counts?.SYNCED ?? 0}
                  detail="Successfully exported"
                />

                <SummaryCard
                  title="Pending"
                  value={counts?.PENDING ?? 0}
                  detail="Waiting for the worker"
                />

                <SummaryCard
                  title="Processing"
                  value={counts?.PROCESSING ?? 0}
                  detail="Currently being handled"
                />

                <SummaryCard
                  title="Retry Scheduled"
                  value={counts?.RETRY ?? 0}
                  detail="Waiting for another attempt"
                />

                <SummaryCard
                  title="Failed"
                  value={counts?.FAILED ?? 0}
                  detail="Requires administrative attention"
                />
              </div>
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-950">
                  Recent Synchronization Jobs
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Latest 100 jobs, newest first
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Order</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Attempts</th>
                      <th className="px-5 py-4">ERP Reference</th>
                      <th className="px-5 py-4">Updated</th>
                      <th className="px-5 py-4">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {data.jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {job.orderNumber}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge status={job.status} />
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {job.attempts}
                        </td>

                        <td className="px-5 py-4 font-mono text-xs text-slate-600">
                          {job.externalReference ?? "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(job.updatedAt)}
                        </td>

                        <td className="px-5 py-4">
                          {job.status === "FAILED" ||
                          job.status === "RETRY" ? (
                            <button
                              type="button"
                              disabled={retryingJobId !== null}
                              onClick={() => void retryJob(job)}
                              className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {retryingJobId === job.id
                                ? "Requeuing..."
                                : "Retry"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {data.jobs.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-slate-500"
                        >
                          No synchronization jobs yet.
                          Paid orders will be queued
                          automatically.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <ErpInventoryPanel />

            <p className="text-xs leading-6 text-slate-500">
              Last updated: {formatDate(data.generatedAt)}.
              The background worker processes eligible
              jobs approximately every minute. ERP
              provider responses are simulated locally.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
