"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import { useStore } from "@/components/store-provider";
import { apiFetch } from "@/lib/api";
import {
  formatDate,
  formatMoney,
  formatStatus,
} from "@/lib/format";
import type { OrderSummary } from "@/lib/types";

function hasActivePaymentWindow(
  order: OrderSummary,
  currentTime: number,
): boolean {
  return (
    currentTime > 0 &&
    order.status ===
      "PENDING_PAYMENT" &&
    new Date(
      order.reservationExpiresAt,
    ).getTime() > currentTime
  );
}

function hasExpiredPaymentWindow(
  order: OrderSummary,
  currentTime: number,
): boolean {
  return (
    currentTime > 0 &&
    order.status ===
      "PENDING_PAYMENT" &&
    new Date(
      order.reservationExpiresAt,
    ).getTime() <= currentTime
  );
}

export default function OrdersPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
  } = useStore();

  const [orders, setOrders] =
    useState<OrderSummary[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [
    currentTime,
    setCurrentTime,
  ] = useState(0);

  useEffect(() => {
    const updateCurrentTime = () => {
      setCurrentTime(Date.now());
    };

    const initialTimer =
      window.setTimeout(
        updateCurrentTime,
        0,
      );

    const interval =
      window.setInterval(
        updateCurrentTime,
        30_000,
      );

    return () => {
      window.clearTimeout(
        initialTimer,
      );

      window.clearInterval(
        interval,
      );
    };
  }, []);

  useEffect(() => {
    if (
      !authLoading &&
      !user
    ) {
      router.replace("/login");
      return;
    }

    if (
      !authLoading &&
      user
    ) {
      void apiFetch<{
        orders: OrderSummary[];
      }>("/api/orders?page=1&limit=50")
        .then((response) => {
          setOrders(
            response.orders,
          );

          setError(null);
        })
        .catch(
          (caught: unknown) =>
            setError(
              caught instanceof Error
                ? caught.message
                : "Could not load orders.",
            ),
        )
        .finally(() =>
          setLoading(false),
        );
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <p className="text-slate-500">
          Loading orders...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <Link
        href="/account"
        className="text-sm font-semibold text-blue-600"
      >
        ← Account
      </Link>

      <h1 className="mt-5 text-4xl font-bold tracking-tight">
        Your orders
      </h1>

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <h2 className="font-semibold">
            No orders yet
          </h2>

          <Link
            href="/products"
            className="mt-4 inline-flex text-sm font-semibold text-blue-600"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {orders.map((order) => {
            const canContinuePayment =
              hasActivePaymentWindow(
                order,
                currentTime,
              );

            const paymentWindowExpired =
              hasExpiredPaymentWindow(
                order,
                currentTime,
              );

            return (
              <article
                key={order.id}
                className="grid gap-5 rounded-2xl border border-slate-200 p-5 transition hover:border-blue-300 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <Link
                    href={`/account/orders/${order.id}`}
                    prefetch={false}
                    className="font-semibold transition hover:text-blue-600"
                  >
                    {
                      order.orderNumber
                    }
                  </Link>

                  <p className="mt-2 text-sm text-slate-500">
                    {formatDate(
                      order.createdAt,
                    )}
                    {" · "}
                    {
                      order.itemCount
                    }{" "}
                    item
                    {order.itemCount ===
                    1
                      ? ""
                      : "s"}
                  </p>

                  {canContinuePayment && (
                    <p className="mt-2 text-xs text-slate-500">
                      Payment reserved
                      until{" "}
                      {formatDate(
                        order.reservationExpiresAt,
                      )}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start gap-3 sm:items-end sm:text-right">
                  <div>
                    <p className="font-bold">
                      {formatMoney(
                        order.totalInCents,
                        order.currency,
                      )}
                    </p>

                    <p
                      className={`mt-2 text-sm font-semibold ${
                        paymentWindowExpired
                          ? "text-amber-600"
                          : "text-blue-600"
                      }`}
                    >
                      {paymentWindowExpired
                        ? "Payment window expired"
                        : formatStatus(
                            order.status,
                          )}
                    </p>
                  </div>

                  {canContinuePayment && (
                    <Link
                      href={`/checkout/${order.id}`}
                      prefetch={false}
                      className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      Continue payment
                    </Link>
                  )}

                  <Link
                    href={`/account/orders/${order.id}`}
                    prefetch={false}
                    className="text-xs font-semibold text-slate-500 transition hover:text-blue-600"
                  >
                    View order
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
