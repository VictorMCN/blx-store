"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import type {
  AdminDashboardResponse,
  AdminInventoryItem,
  AdminInventoryResponse,
  AdminOrder,
  AdminOrdersResponse,
} from "@/lib/admin-types";
import {
  formatMoney,
} from "@/lib/format";
import type {
  OrderStatus,
} from "@/lib/types";
import {
  useStore,
} from "@/components/store-provider";

const FULFILLMENT_STATUSES: OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

const STATUS_FILTERS: Array<
  OrderStatus | "ALL"
> = [
  "ALL",
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
  "EXPIRED",
];

function formatStatus(
  status: OrderStatus,
) {
  const labels: Record<
    OrderStatus,
    string
  > = {
    PENDING_PAYMENT:
      "Awaiting payment",
    PAID:
      "Paid",
    PROCESSING:
      "Processing",
    SHIPPED:
      "Shipped",
    DELIVERED:
      "Delivered",
    CANCELED:
      "Canceled",
    EXPIRED:
      "Expired",
  };

  return labels[status];
}

function statusClasses(
  status: OrderStatus,
) {
  switch (status) {
    case "PAID":
      return "bg-blue-50 text-blue-700 ring-blue-200";

    case "PROCESSING":
      return "bg-amber-50 text-amber-700 ring-amber-200";

    case "SHIPPED":
      return "bg-violet-50 text-violet-700 ring-violet-200";

    case "DELIVERED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    case "CANCELED":
    case "EXPIRED":
      return "bg-slate-100 text-slate-500 ring-slate-200";

    default:
      return "bg-orange-50 text-orange-700 ring-orange-200";
  }
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(value),
  );
}

async function fetchAdminData() {
  const [
    dashboard,
    orders,
    inventory,
  ] = await Promise.all([
    apiFetch<AdminDashboardResponse>(
      "/api/admin/dashboard",
    ),

    apiFetch<AdminOrdersResponse>(
      "/api/admin/orders",
    ),

    apiFetch<AdminInventoryResponse>(
      "/api/admin/inventory",
    ),
  ]);

  return {
    dashboard,
    orders,
    inventory,
  };
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function InventoryStatus({
  item,
}: {
  item: AdminInventoryItem;
}) {
  if (!item.hasInventory) {
    return (
      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
        Missing inventory
      </span>
    );
  }

  if (item.isOutOfStock) {
    return (
      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
        Out of stock
      </span>
    );
  }

  if (item.isLowStock) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        Low stock
      </span>
    );
  }

  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
      Healthy
    </span>
  );
}

export default function AdminPage() {
  const router =
    useRouter();

  const {
    user,
    authLoading,
  } =
    useStore();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<AdminDashboardResponse | null>(
      null,
    );

  const [
    orders,
    setOrders,
  ] =
    useState<AdminOrder[]>([]);

  const [
    inventory,
    setInventory,
  ] =
    useState<
      AdminInventoryItem[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      OrderStatus | "ALL"
    >("ALL");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    updatingOrderId,
    setUpdatingOrderId,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace(
        "/login",
      );

      return;
    }

    if (
      user.role !== "ADMIN"
    ) {
      router.replace("/");

      return;
    }

    let cancelled =
      false;

    async function load() {
      try {
        const data =
          await fetchAdminData();

        if (cancelled) {
          return;
        }

        setDashboard(
          data.dashboard,
        );

        setOrders(
          data.orders.orders,
        );

        setInventory(
          data.inventory
            .inventory,
        );
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof
              Error
              ? caught.message
              : "Could not load the admin dashboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    user,
    router,
  ]);

  const filteredOrders =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          if (
            statusFilter !==
              "ALL" &&
            order.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            !normalizedSearch
          ) {
            return true;
          }

          const customerMatches =
            order.customerName
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            order.customerEmail
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const orderMatches =
            order.orderNumber
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const itemMatches =
            order.items.some(
              (item) =>
                item.productName
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ) ||
                item.productSku
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            );

          return (
            customerMatches ||
            orderMatches ||
            itemMatches
          );
        },
      );
    }, [
      orders,
      statusFilter,
      search,
    ]);

  async function refreshData() {
    const data =
      await fetchAdminData();

    setDashboard(
      data.dashboard,
    );

    setOrders(
      data.orders.orders,
    );

    setInventory(
      data.inventory.inventory,
    );
  }

  async function changeFulfillmentStatus(
    order: AdminOrder,
    status: OrderStatus,
  ) {
    if (
      status ===
      order.status
    ) {
      return;
    }

    setUpdatingOrderId(
      order.id,
    );

    setError(null);

    try {
      await apiFetch(
        `/api/admin/orders/${order.id}/fulfillment-status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
          }),
        },
      );

      await refreshData();
    } catch (caught) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : "Could not update the order.",
      );
    } finally {
      setUpdatingOrderId(
        null,
      );
    }
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-[1440px] px-5 py-16 lg:px-8">
        <p className="text-sm font-medium text-slate-500">
          Loading admin dashboard...
        </p>
      </main>
    );
  }

  if (
    !user ||
    user.role !== "ADMIN"
  ) {
    return null;
  }

  const metrics =
    dashboard?.metrics;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Administration
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
              Store operations
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Monitor orders, fulfillment and inventory from one operational workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/monitoring"
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
            >
              System Monitoring
            </Link>

            <Link
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              View storefront
            </Link>

            <button
              type="button"
              onClick={() =>
                void refreshData()
              }
              className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Refresh data
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Paid revenue"
            value={
              metrics
                ? formatMoney(
                    metrics.paidRevenueInCents,
                    metrics.currency,
                  )
                : "—"
            }
            detail="Paid and fulfilled orders"
          />

          <MetricCard
            label="Total orders"
            value={
              metrics
                ? String(
                    metrics.totalOrders,
                  )
                : "—"
            }
            detail="All order records"
          />

          <MetricCard
            label="Active fulfillment"
            value={
              metrics
                ? String(
                    metrics.activeFulfillmentOrders,
                  )
                : "—"
            }
            detail="Paid, processing or shipped"
          />

          <MetricCard
            label="Low stock"
            value={
              metrics
                ? String(
                    metrics.lowStockProducts,
                  )
                : "—"
            }
            detail="Products at or below reorder point"
          />
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Orders
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Search customers, products and orders, then manage fulfillment status.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(260px,1fr)_190px]">
                <div>
                  <label
                    htmlFor="admin-order-search"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Search
                  </label>

                  <input
                    id="admin-order-search"
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Customer, email, order, product or SKU..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-status-filter"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Status
                  </label>

                  <select
                    id="admin-status-filter"
                    value={
                      statusFilter
                    }
                    onChange={(
                      event,
                    ) =>
                      setStatusFilter(
                        event
                          .target
                          .value as
                          | OrderStatus
                          | "ALL",
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
                  >
                    {STATUS_FILTERS.map(
                      (
                        status,
                      ) => (
                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {status ===
                          "ALL"
                            ? "All statuses"
                            : formatStatus(
                                status,
                              )}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Showing{" "}
              {
                filteredOrders.length
              }{" "}
              of {orders.length} orders.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-4">
                    Order
                  </th>

                  <th className="px-6 py-4">
                    Customer
                  </th>

                  <th className="px-6 py-4">
                    Products
                  </th>

                  <th className="px-6 py-4">
                    Date
                  </th>

                  <th className="px-6 py-4">
                    Total
                  </th>

                  <th className="px-6 py-4">
                    Status
                  </th>

                  <th className="px-6 py-4">
                    Fulfillment
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(
                  (order) => {
                    const editable =
                      FULFILLMENT_STATUSES.includes(
                        order.status,
                      );

                    return (
                      <tr
                        key={
                          order.id
                        }
                        className="hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-5">
                          <p className="font-semibold text-slate-950">
                            {
                              order.orderNumber
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {
                              order.itemCount
                            }{" "}
                            item
                            {order.itemCount ===
                            1
                              ? ""
                              : "s"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <p className="font-medium text-slate-800">
                            {
                              order.customerName
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {
                              order.customerEmail
                            }
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            {order.items.map(
                              (
                                item,
                              ) => (
                                <p
                                  key={`${item.productSku}-${item.productName}`}
                                  className="text-xs text-slate-600"
                                >
                                  {
                                    item.quantity
                                  }
                                  ×{" "}
                                  {
                                    item.productName
                                  }
                                </p>
                              ),
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-5 text-slate-500">
                          {formatDate(
                            order.createdAt,
                          )}
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-950">
                          {formatMoney(
                            order.totalInCents,
                            order.currency,
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(
                              order.status,
                            )}`}
                          >
                            {formatStatus(
                              order.status,
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          {editable ? (
                            <select
                              value={
                                order.status
                              }
                              disabled={
                                updatingOrderId ===
                                order.id
                              }
                              onChange={(
                                event,
                              ) =>
                                void changeFulfillmentStatus(
                                  order,
                                  event
                                    .target
                                    .value as OrderStatus,
                                )
                              }
                              className="h-9 min-w-[150px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {FULFILLMENT_STATUSES.map(
                                (
                                  status,
                                ) => (
                                  <option
                                    key={
                                      status
                                    }
                                    value={
                                      status
                                    }
                                  >
                                    {formatStatus(
                                      status,
                                    )}
                                  </option>
                                ),
                              )}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Payment state
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}

                {filteredOrders.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      No orders match the current search and filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-950">
              Inventory
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Physical, reserved and available stock across the active catalog.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-4">
                    Product
                  </th>

                  <th className="px-6 py-4">
                    SKU
                  </th>

                  <th className="px-6 py-4 text-right">
                    Physical
                  </th>

                  <th className="px-6 py-4 text-right">
                    Reserved
                  </th>

                  <th className="px-6 py-4 text-right">
                    Available
                  </th>

                  <th className="px-6 py-4 text-right">
                    Reorder point
                  </th>

                  <th className="px-6 py-4">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {inventory.map(
                  (item) => (
                    <tr
                      key={
                        item.productId
                      }
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-5 font-semibold text-slate-950">
                        {
                          item.name
                        }
                      </td>

                      <td className="px-6 py-5 text-slate-500">
                        {
                          item.sku
                        }
                      </td>

                      <td className="px-6 py-5 text-right text-slate-600">
                        {
                          item.quantity
                        }
                      </td>

                      <td className="px-6 py-5 text-right text-slate-600">
                        {
                          item.reservedQuantity
                        }
                      </td>

                      <td className="px-6 py-5 text-right font-semibold text-slate-950">
                        {
                          item.availableQuantity
                        }
                      </td>

                      <td className="px-6 py-5 text-right text-slate-500">
                        {
                          item.reorderPoint
                        }
                      </td>

                      <td className="px-6 py-5">
                        <InventoryStatus
                          item={
                            item
                          }
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
