"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  ErpInventoryResponse,
} from "@/lib/erp-types";

export function ErpInventoryPanel() {
  const [data, setData] =
    useState<ErpInventoryResponse | null>(null);

  const [error, setError] =
    useState(false);

  const refresh = useCallback(async () => {
    try {
      const result =
        await apiFetch<ErpInventoryResponse>(
          "/api/admin/erp/inventory",
        );

      setData(result);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(
      () => void refresh(),
      0,
    );

    const interval = window.setInterval(
      () => void refresh(),
      15_000,
    );

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-950">
          Mock ERP Inventory
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Latest synchronized stock snapshots,
          limited to 100 SKUs.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-rose-700">
          Unable to load ERP inventory data.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">SKU</th>
              <th className="px-5 py-4">On Hand</th>
              <th className="px-5 py-4">Reserved</th>
              <th className="px-5 py-4">Available</th>
              <th className="px-5 py-4">Last Synced</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {data?.inventory.map((item) => (
              <tr key={item.sku}>
                <td className="px-5 py-4 font-mono font-medium text-slate-900">
                  {item.sku}
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {item.onHandQuantity}
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {item.reservedQuantity}
                </td>

                <td className="px-5 py-4 font-semibold text-slate-900">
                  {item.availableQuantity}
                </td>

                <td className="px-5 py-4 text-slate-500">
                  {new Date(item.syncedAt).toLocaleString("en-US")}
                </td>
              </tr>
            ))}

            {data && data.inventory.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  No inventory snapshots yet.
                  The synchronization worker runs every minute.
                </td>
              </tr>
            )}

            {!data && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  Loading ERP inventory...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
