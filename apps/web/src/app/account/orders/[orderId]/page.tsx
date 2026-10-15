"use client";

import Link from "next/link";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import {
  formatDate,
  formatMoney,
  formatStatus,
} from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

const PAYMENT_CONFIRMATION_ATTEMPTS =
  5;

const PAYMENT_CONFIRMATION_DELAY_MS =
  1200;

function wait(
  milliseconds: number,
) {
  return new Promise<void>(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function OrderDetailContent() {
  const params =
    useParams<{
      orderId: string;
    }>();

  const router = useRouter();

  const searchParams =
    useSearchParams();

  const paymentReturn =
    searchParams.get("payment") ===
    "return";

  const [order, setOrder] =
    useState<OrderDetail | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [
    confirmingPayment,
    setConfirmingPayment,
  ] =
    useState(false);

  const [
    paymentConfirmed,
    setPaymentConfirmed,
  ] =
    useState(false);

  const [
    currentTime,
    setCurrentTime,
  ] = useState(0);

  const [error, setError] =
    useState<string | null>(null);

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
    let cancelled = false;

    async function fetchOrder() {
      return apiFetch<{
        order: OrderDetail;
      }>(
        `/api/orders/${params.orderId}`,
      );
    }

    async function reconcilePayment(
      currentOrder: OrderDetail,
    ) {
      if (
        !paymentReturn ||
        currentOrder.status !==
          "PENDING_PAYMENT"
      ) {
        return currentOrder;
      }

      setConfirmingPayment(true);

      try {
        await apiFetch(
          `/api/orders/${params.orderId}/payment`,
          {
            method: "POST",
          },
        );
      } catch {
        /*
         * The Stripe webhook may have
         * completed the order at the
         * same time.
         */
      }

      let latestOrder =
        (
          await fetchOrder()
        ).order;

      for (
        let attempt = 1;
        attempt <
        PAYMENT_CONFIRMATION_ATTEMPTS;
        attempt += 1
      ) {
        if (
          latestOrder.status !==
          "PENDING_PAYMENT"
        ) {
          break;
        }

        await wait(
          PAYMENT_CONFIRMATION_DELAY_MS,
        );

        latestOrder =
          (
            await fetchOrder()
          ).order;
      }

      return latestOrder;
    }

    async function load() {
      try {
        const response =
          await fetchOrder();

        if (cancelled) {
          return;
        }

        setOrder(
          response.order,
        );

        setError(null);
        setLoading(false);

        const latestOrder =
          await reconcilePayment(
            response.order,
          );

        if (cancelled) {
          return;
        }

        setOrder(latestOrder);

        if (
          paymentReturn &&
          latestOrder.status !==
            "PENDING_PAYMENT"
        ) {
          setPaymentConfirmed(
            latestOrder.status ===
              "PAID" ||
              latestOrder.status ===
                "PROCESSING" ||
              latestOrder.status ===
                "SHIPPED" ||
              latestOrder.status ===
                "DELIVERED",
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load order.",
          );

          setLoading(false);
        }
      } finally {
        if (!cancelled) {
          setConfirmingPayment(
            false,
          );

          if (paymentReturn) {
            router.replace(
              `/account/orders/${params.orderId}`,
            );
          }
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    params.orderId,
    paymentReturn,
    router,
  ]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16">
        <p className="text-slate-500">
          Loading order...
        </p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16">
        <h1 className="text-2xl font-bold">
          Order unavailable
        </h1>

        <p className="mt-3 text-slate-600">
          {error ??
            "This order could not be found."}
        </p>

        <Link
          href="/account/orders"
          className="mt-6 inline-flex text-sm font-semibold text-blue-600"
        >
          ← Back to orders
        </Link>
      </main>
    );
  }

  const paymentWindowExpired =
    currentTime > 0 &&
    order.status ===
      "PENDING_PAYMENT" &&
    new Date(
      order.reservationExpiresAt,
    ).getTime() <= currentTime;

  const canContinuePayment =
    currentTime > 0 &&
    order.status ===
      "PENDING_PAYMENT" &&
    !paymentWindowExpired;

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/account/orders"
        className="text-sm font-semibold text-blue-600"
      >
        ← Orders
      </Link>

      {paymentConfirmed && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="font-semibold text-emerald-800">
            Payment confirmed
          </p>

          <p className="mt-1 text-sm text-emerald-700">
            Your payment was successfully
            confirmed and the order has
            been received.
          </p>
        </div>
      )}

      {confirmingPayment &&
        order.status ===
          "PENDING_PAYMENT" && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="font-semibold text-amber-800">
              Confirming payment
            </p>

            <p className="mt-1 text-sm text-amber-700">
              Stripe completed the
              checkout. BLX Store is
              confirming the payment
              status.
            </p>
          </div>
        )}

      {paymentWindowExpired && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="font-semibold text-amber-800">
            Payment window expired
          </p>

          <p className="mt-1 text-sm text-amber-700">
            The stock reservation for
            this order has expired and
            payment can no longer be
            continued.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-6">
        <div>
          <p className="text-sm text-slate-500">
            Order
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            {order.orderNumber}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {formatDate(
              order.createdAt,
            )}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end sm:text-right">
          <div>
            <p
              className={`font-semibold ${
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

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(
                order.totalInCents,
                order.currency,
              )}
            </p>
          </div>

          {canContinuePayment &&
            !confirmingPayment && (
              <Link
                href={`/checkout/${order.id}`}
                prefetch={false}
                className="inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Continue payment
              </Link>
            )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold">
            Items
          </h2>

          <div className="mt-5 divide-y divide-slate-200">
            {order.items.map(
              (item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-4 first:pt-0"
                >
                  <div>
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="font-semibold hover:text-blue-600"
                    >
                      {
                        item.productName
                      }
                    </Link>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        item.quantity
                      }{" "}
                      ×{" "}
                      {formatMoney(
                        item.unitPriceInCents,
                        order.currency,
                      )}
                    </p>
                  </div>

                  <p className="font-semibold">
                    {formatMoney(
                      item.lineTotalInCents,
                      order.currency,
                    )}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold">
              Shipping
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {
                order.shippingRecipientName
              }
              <br />

              {
                order.shippingStreet
              }
              ,{" "}
              {
                order.shippingNumber
              }

              {order.shippingComplement
                ? ` · ${order.shippingComplement}`
                : ""}
              <br />

              {order.shippingNeighborhood
                ? `${order.shippingNeighborhood} · `
                : ""}

              {order.shippingCity},{" "}
              {order.shippingState}
              <br />

              {
                order.shippingPostalCode
              }
              <br />

              {
                order.shippingCountry
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold">
              Summary
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Subtotal
                </span>

                <span>
                  {formatMoney(
                    order.subtotalInCents,
                    order.currency,
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">
                  Shipping
                </span>

                <span>
                  {formatMoney(
                    order.shippingInCents,
                    order.currency,
                  )}
                </span>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3 font-bold">
                <span>
                  Total
                </span>

                <span>
                  {formatMoney(
                    order.totalInCents,
                    order.currency,
                  )}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-5 py-16">
          <p className="text-slate-500">
            Loading order...
          </p>
        </main>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}
