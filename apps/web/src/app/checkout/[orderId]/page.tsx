"use client";

import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

const publishableKey =
  process.env
    .NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const stripePromise =
  publishableKey
    ? loadStripe(publishableKey)
    : null;

interface PaymentResponse {
  payment: {
    id: string;
    provider: string;
    status: string;
    amountInCents: number;
    currency: string;
  };
  clientSecret: string;
}

function CheckoutPaymentForm({
  orderId,
}: {
  orderId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function submitPayment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !stripe ||
      !elements ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const submitResult =
        await elements.submit();

      if (submitResult.error) {
        setError(
          submitResult.error.message ??
            "Please review your payment information.",
        );

        setSubmitting(false);
        return;
      }

      const result =
        await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url:
              `${window.location.origin}/account/orders/${orderId}?payment=return`,
          },
        });

      if (result.error) {
        setError(
          result.error.message ??
            "Payment could not be completed.",
        );

        setSubmitting(false);
        return;
      }

      /*
       * Successful Stripe confirmations normally
       * redirect to return_url.
       *
       * This is only a fallback for payment methods
       * that complete without a browser redirect.
       */
      router.push(
        `/account/orders/${orderId}?payment=return`,
      );
    } catch (caught) {
      console.error(
        "Stripe payment confirmation failed.",
        caught,
      );

      setError(
        caught instanceof Error
          ? caught.message
          : "Unexpected error while processing payment.",
      );

      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submitPayment}
      className="mt-6"
    >
      <PaymentElement />

      {error && (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">
            Payment could not be completed
          </p>

          <p className="mt-1">
            {error}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={
          !stripe ||
          !elements ||
          submitting
        }
        className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
      >
        {submitting
          ? "Processing payment..."
          : "Pay securely"}
      </button>

      {submitting && (
        <p className="mt-3 text-center text-xs text-slate-500">
          Please keep this page open while
          Stripe confirms the payment.
        </p>
      )}

      <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">
        Card data is handled securely by
        Stripe and is never stored by BLX
        Store.
      </p>
    </form>
  );
}

function PaymentPageContent() {
  const params =
    useParams<{
      orderId: string;
    }>();

  const [order, setOrder] =
    useState<OrderDetail | null>(
      null,
    );

  const [
    paymentResponse,
    setPaymentResponse,
  ] =
    useState<PaymentResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initializePayment() {
      try {
        const [
          orderResponse,
          payment,
        ] = await Promise.all([
          apiFetch<{
            order: OrderDetail;
          }>(
            `/api/orders/${params.orderId}`,
          ),

          apiFetch<PaymentResponse>(
            `/api/orders/${params.orderId}/payment`,
            {
              method: "POST",
            },
          ),
        ]);

        if (!cancelled) {
          setOrder(
            orderResponse.order,
          );

          setPaymentResponse(
            payment,
          );

          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not initialize payment.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initializePayment();

    return () => {
      cancelled = true;
    };
  }, [params.orderId]);

  if (loading) {
    return (
      <main className="min-h-[60vh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-[1050px] px-5 py-14">
          <p className="text-sm text-slate-500">
            Preparing secure payment...
          </p>
        </div>
      </main>
    );
  }

  if (!publishableKey) {
    return (
      <main className="min-h-[60vh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-xl px-5 py-16">
          <div className="rounded-xl border border-amber-200 bg-white p-6">
            <h1 className="text-xl font-semibold">
              Stripe configuration required
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              The storefront needs the
              Stripe publishable test key
              before the Payment Element can
              be displayed.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (
    error ||
    !order ||
    !paymentResponse
  ) {
    return (
      <main className="min-h-[60vh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-xl px-5 py-16">
          <div className="rounded-xl border border-rose-200 bg-white p-6">
            <h1 className="text-xl font-semibold">
              Payment unavailable
            </h1>

            <p className="mt-3 text-sm text-slate-500">
              {error ??
                "Payment could not be initialized."}
            </p>

            <Link
              href={`/account/orders/${params.orderId}`}
              prefetch={false}
              className="mt-5 inline-flex text-sm font-semibold text-blue-600"
            >
              View order
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] bg-[#f6f7f8]">
      <div className="mx-auto max-w-[1050px] px-5 py-10 lg:px-8">
        <p className="text-xs text-slate-400">
          Cart / Checkout / Payment
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Secure payment
        </h1>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-slate-400">
            1. Shipping
          </span>

          <span className="text-slate-300">
            →
          </span>

          <span className="font-semibold text-blue-600">
            2. Payment
          </span>

          <span className="text-slate-300">
            →
          </span>

          <span className="text-slate-400">
            3. Confirmation
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="border-b border-slate-200 pb-5">
              <p className="text-xs text-slate-400">
                Order
              </p>

              <h2 className="mt-1 font-semibold">
                {order.orderNumber}
              </h2>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret:
                  paymentResponse.clientSecret,

                appearance: {
                  theme: "stripe",

                  variables: {
                    colorPrimary:
                      "#2563eb",

                    colorText:
                      "#0f172a",

                    colorBackground:
                      "#ffffff",

                    borderRadius:
                      "8px",
                  },
                },
              }}
            >
              <CheckoutPaymentForm
                orderId={order.id}
              />
            </Elements>
          </section>

          <aside className="h-fit rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">
              Order summary
            </h2>

            <div className="mt-5 space-y-4">
              {order.items.map(
                (item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-700">
                        {
                          item.productName
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Qty{" "}
                        {
                          item.quantity
                        }
                      </p>
                    </div>

                    <p className="whitespace-nowrap text-slate-600">
                      {formatMoney(
                        item.lineTotalInCents,
                        order.currency,
                      )}
                    </p>
                  </div>
                ),
              )}
            </div>

            <div className="mt-5 flex justify-between border-t border-slate-200 pt-5">
              <span className="font-semibold">
                Total
              </span>

              <span className="text-xl font-bold">
                {formatMoney(
                  order.totalInCents,
                  order.currency,
                )}
              </span>
            </div>

            <div className="mt-6 rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">
                Shipping to
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
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
                <br />

                {order.shippingCity},{" "}
                {order.shippingState}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[60vh] bg-[#f6f7f8] px-5 py-16">
          <p className="mx-auto max-w-[1050px] text-sm text-slate-500">
            Preparing payment...
          </p>
        </main>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}
