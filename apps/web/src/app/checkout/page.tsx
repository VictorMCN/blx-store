"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import { useStore } from "@/components/store-provider";
import {
  apiFetch,
  ApiError,
} from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type {
  Address,
  Cart,
  CustomerProfile,
  OrderDetail,
} from "@/lib/types";

export default function CheckoutPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
    refreshCart,
  } = useStore();

  const [profile, setProfile] =
    useState<CustomerProfile | null>(
      null,
    );

  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [cart, setCart] =
    useState<Cart | null>(null);

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function loadCheckout() {
      try {
        const [
          profileResponse,
          addressResponse,
          cartResponse,
        ] = await Promise.all([
          apiFetch<{
            profile:
              | CustomerProfile
              | null;
          }>("/api/account/profile"),

          apiFetch<{
            addresses: Address[];
          }>(
            "/api/account/addresses",
          ),

          apiFetch<{
            cart: Cart;
          }>("/api/cart"),
        ]);

        if (cancelled) {
          return;
        }

        setProfile(
          profileResponse.profile,
        );

        setAddresses(
          addressResponse.addresses,
        );

        setCart(
          cartResponse.cart,
        );

        const defaultAddress =
          addressResponse.addresses.find(
            (address) =>
              address.isDefault,
          ) ??
          addressResponse.addresses[0];

        setSelectedAddressId(
          defaultAddress?.id ?? "",
        );
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          caught.status === 401
        ) {
          router.replace("/login");
          return;
        }

        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load checkout.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCheckout();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    user,
    router,
  ]);

  async function createOrder() {
    if (!selectedAddressId) {
      setError(
        "Select a shipping address.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response =
        await apiFetch<{
          order: OrderDetail;
        }>("/api/orders", {
          method: "POST",
          body: JSON.stringify({
            addressId:
              selectedAddressId,
          }),
        });

      await refreshCart();

      router.push(
        `/checkout/${response.order.id}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create order.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-[60vh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8">
          <p className="text-sm text-slate-500">
            Loading checkout...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="min-h-[60vh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Your cart is empty
          </h1>

          <Link
            href="/products"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
          >
            Browse products
          </Link>
        </div>
      </main>
    );
  }

  const setupComplete =
    Boolean(profile) &&
    addresses.length > 0;

  return (
    <main className="min-h-[70vh] bg-[#f6f7f8]">
      <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-8">
        <p className="text-xs text-slate-400">
          Cart / Checkout
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Checkout
        </h1>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="font-semibold text-blue-600">
            1. Shipping
          </span>

          <span className="text-slate-300">
            →
          </span>

          <span className="text-slate-400">
            2. Payment
          </span>

          <span className="text-slate-300">
            →
          </span>

          <span className="text-slate-400">
            3. Confirmation
          </span>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            {!profile && (
              <div className="rounded-xl border border-amber-200 bg-white p-6">
                <h2 className="font-semibold text-slate-950">
                  Customer profile required
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Complete your customer
                  information before placing
                  the order.
                </p>

                <Link
                  href="/account"
                  className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Complete profile
                </Link>
              </div>
            )}

            {profile &&
              addresses.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-white p-6">
                  <h2 className="font-semibold text-slate-950">
                    Shipping address required
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Add at least one
                    shipping address before
                    placing your order.
                  </p>

                  <Link
                    href="/account"
                    className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Add address
                  </Link>
                </div>
              )}

            {addresses.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="font-semibold text-slate-950">
                    Shipping address
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Choose where your order
                    should be delivered.
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {addresses.map(
                    (address) => (
                      <label
                        key={address.id}
                        className="flex cursor-pointer gap-4 p-5 transition hover:bg-slate-50"
                      >
                        <input
                          type="radio"
                          name="address"
                          value={
                            address.id
                          }
                          checked={
                            selectedAddressId ===
                            address.id
                          }
                          onChange={() =>
                            setSelectedAddressId(
                              address.id,
                            )
                          }
                          className="mt-1"
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">
                              {address.label ??
                                "Address"}
                            </p>

                            {address.isDefault && (
                              <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                                Default
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {
                              address.recipientName
                            }
                            <br />

                            {
                              address.street
                            }
                            ,{" "}
                            {
                              address.number
                            }

                            {address.complement
                              ? ` · ${address.complement}`
                              : ""}

                            <br />

                            {address.neighborhood
                              ? `${address.neighborhood} · `
                              : ""}

                            {address.city},{" "}
                            {address.state}
                            <br />

                            {
                              address.postalCode
                            }{" "}
                            ·{" "}
                            {
                              address.country
                            }
                          </p>
                        </div>
                      </label>
                    ),
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-950">
                  Products
                </h2>
              </div>

              <div className="divide-y divide-slate-200">
                {cart.items.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-6 px-6 py-5"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {
                            item.product
                              .name
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Quantity{" "}
                          {item.quantity}
                        </p>
                      </div>

                      <p className="whitespace-nowrap font-semibold text-slate-950">
                        {formatMoney(
                          item.lineTotalInCents,
                          item.product
                            .currency,
                        )}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-xl border border-slate-200 bg-white p-6 lg:sticky lg:top-36">
            <h2 className="text-lg font-semibold text-slate-950">
              Order summary
            </h2>

            <div className="mt-5 flex justify-between text-sm text-slate-500">
              <span>
                Subtotal
              </span>

              <span>
                {formatMoney(
                  cart.subtotalInCents,
                  cart.currency ??
                    "BRL",
                )}
              </span>
            </div>

            <div className="mt-3 flex justify-between text-sm text-slate-500">
              <span>
                Shipping
              </span>

              <span>
                Free
              </span>
            </div>

            <div className="mt-5 flex justify-between border-t border-slate-200 pt-5">
              <span className="font-semibold">
                Total
              </span>

              <span className="text-xl font-bold">
                {formatMoney(
                  cart.subtotalInCents,
                  cart.currency ??
                    "BRL",
                )}
              </span>
            </div>

            <button
              type="button"
              disabled={
                !setupComplete ||
                !selectedAddressId ||
                submitting
              }
              onClick={() =>
                void createOrder()
              }
              className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {submitting
                ? "Creating order..."
                : "Proceed to payment"}
            </button>

            <p className="mt-4 text-xs leading-5 text-slate-400">
              Your inventory will be
              reserved when the order is
              created.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
