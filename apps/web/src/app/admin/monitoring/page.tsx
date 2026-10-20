"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MonitoringDashboard } from "@/components/monitoring-dashboard";
import { apiFetch } from "@/lib/api";
import type {
  MonitoringResponse,
} from "@/lib/monitoring-types";

const REFRESH_INTERVAL_MS = 15_000;

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export default function AdminMonitoringPage() {
  const [data, setData] =
    useState<MonitoringResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function refreshMonitoring() {
      try {
        const response =
          await apiFetch<MonitoringResponse>(
            "/api/admin/monitoring",
          );

        if (!active) {
          return;
        }

        setData(response);
        setError(null);
      } catch {
        if (!active) {
          return;
        }

        setError(
          "Monitoring data is unavailable. Verify your administrator access and API connection.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void refreshMonitoring();

    const interval = window.setInterval(
      () => void refreshMonitoring(),
      REFRESH_INTERVAL_MS,
    );

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              BLX Store · Admin Console
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              System Monitoring
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Application health, performance, AI usage,
              and payment operations.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Back to Dashboard
          </Link>
        </header>

        {data && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <span className="text-sm text-slate-600">
              Live system status
            </span>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={
                  data.health.database === "ok"
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-rose-700"
                }
              >
                {data.health.database === "ok"
                  ? "● Operational"
                  : "● Database unavailable"}
              </span>
              <span className="text-slate-400">
                Updated {formatUpdatedAt(data.generatedAt)}
              </span>
              <span className="text-slate-400">
                Auto-refresh: 15s
              </span>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
          >
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading system monitoring...
          </div>
        )}

        {!loading && !data && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No monitoring data is available.
          </div>
        )}

        {data && <MonitoringDashboard data={data} />}
      </div>
    </main>
  );
}
