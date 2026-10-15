"use client";

import Link from "next/link";
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
import type { Cart } from "@/lib/types";

export default function CartPage() {
  const {
    user,
    authLoading,
    refreshCart,
  } = useStore();

  const [cart, setCart] =
    useState<Cart | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [busyProduct, setBusyProduct] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  async function fetchCart() {
    try {
      const response =
        await apiFetch<{
          cart: Cart;
        }>("/api/cart");

      setCart(response.cart);
      setError(null);
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.status === 401
      ) {
        setCart(null);
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load cart.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      authLoading ||
      !user
    ) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response =
          await apiFetch<{
            cart: Cart;
          }>("/api/cart");

        if (!cancelled) {
          setCart(response.cart);
          setError(null);
        }
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          caught.status === 401
        ) {
          if (!cancelled) {
            setCart(null);
          }

          return;
        }

        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load cart.",
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
  ]);

  async function updateQuantity(
    productId: string,
    quantity: number,
  ) {
    setBusyProduct(productId);

    try {
      await apiFetch(
        `/api/cart/items/${productId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            quantity,
          }),
        },
      );

      await Promise.all([
        fetchCart(),
        refreshCart(),
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update cart.",
      );
    } finally {
      setBusyProduct(null);
    }
  }

  async function remove(
    productId: string,
  ) {
    setBusyProduct(productId);

    try {
      await apiFetch(
        `/api/cart/items/${productId}`,
        {
          method: "DELETE",
        },
      );

      await Promise.all([
        fetchCart(),
        refreshCart(),
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not remove item.",
      );
    } finally {
      setBusyProduct(null);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-[60vh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-[1240px] px-5 py-14 lg:px-8">
          <p className="text-sm text-slate-500">
            Loading cart...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[60vh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Sign in to view your cart
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Your shopping cart is linked
            securely to your account.
          </p>

          <Link
            href="/login"
            className="mt-7 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-600"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (
    !cart ||
    cart.items.length === 0
  ) {
    return (
      <main className="min-h-[60vh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Your cart is empty
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Explore the catalog and find
            something for your setup.
          </p>

          <Link
            href="/products"
            className="mt-7 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Explore products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f6f7f8]">
      <div className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8">
        <p className="text-xs text-slate-400">
          Home / Cart
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Shopping cart
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {cart.totalItemCount} item
          {cart.totalItemCount === 1
            ? ""
            : "s"}{" "}
          in your cart
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {cart.items.map(
              (item, index) => {
                const image =
                  item.product
                    .primaryImage?.url ??
                  null;

                return (
                  <article
                    key={item.id}
                    className={`grid gap-5 p-5 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center ${
                      index > 0
                        ? "border-t border-slate-200"
                        : ""
                    }`}
                  >
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="block"
                    >
                      <div
                        className="aspect-square rounded-lg bg-[#f5f6f7] bg-contain bg-center bg-no-repeat"
                        style={
                          image
                            ? {
                                backgroundImage: `url("${image}")`,
                              }
                            : undefined
                        }
                      />
                    </Link>

                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">
                        {
                          item.product
                            .sku
                        }
                      </p>

                      <Link
                        href={`/products/${item.product.slug}`}
                        className="mt-1 block font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {
                          item.product
                            .name
                        }
                      </Link>

                      {!item
                        .availability
                        .isAvailable && (
                        <p className="mt-2 text-xs font-medium text-rose-600">
                          This item needs
                          attention before
                          checkout.
                        </p>
                      )}

                      <div className="mt-4 flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          Qty

                          <input
                            type="number"
                            min={1}
                            max={99}
                            defaultValue={
                              item.quantity
                            }
                            disabled={
                              busyProduct ===
                              item.product
                                .id
                            }
                            onBlur={(
                              event,
                            ) => {
                              const value =
                                Number(
                                  event
                                    .target
                                    .value,
                                );

                              if (
                                value >= 1 &&
                                value <=
                                  99 &&
                                value !==
                                  item.quantity
                              ) {
                                void updateQuantity(
                                  item
                                    .product
                                    .id,
                                  value,
                                );
                              }
                            }}
                            className="w-16 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={
                            busyProduct ===
                            item.product.id
                          }
                          onClick={() =>
                            void remove(
                              item.product
                                .id,
                            )
                          }
                          className="text-xs font-semibold text-slate-400 transition hover:text-rose-600 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <p className="text-right text-base font-bold text-slate-950">
                      {formatMoney(
                        item.lineTotalInCents,
                        item.product
                          .currency,
                      )}
                    </p>
                  </article>
                );
              },
            )}
          </section>

          <aside className="h-fit rounded-xl border border-slate-200 bg-white p-6 lg:sticky lg:top-36">
            <h2 className="text-lg font-semibold text-slate-950">
              Summary
            </h2>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span>
                  Products
                </span>

                <span>
                  {formatMoney(
                    cart.subtotalInCents,
                    cart.currency ??
                      "BRL",
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>
                  Shipping
                </span>

                <span className="font-medium text-emerald-600">
                  Calculated at checkout
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5">
              <span className="font-semibold text-slate-900">
                Subtotal
              </span>

              <span className="text-xl font-bold text-slate-950">
                {formatMoney(
                  cart.subtotalInCents,
                  cart.currency ??
                    "BRL",
                )}
              </span>
            </div>

            {cart.canCheckout ? (
              <Link
                href="/checkout"
                className="mt-6 flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Continue checkout
              </Link>
            ) : (
              <div className="mt-6 flex w-full items-center justify-center rounded-lg bg-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-500">
                Checkout unavailable
              </div>
            )}

            <p className="mt-4 text-xs leading-5 text-slate-400">
              Choose your shipping address and review your order before payment.
            </p>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="text-xs font-medium text-slate-500">
                Secure checkout
              </p>

              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                Payment data is handled by
                the payment provider and is
                never stored by BLX Store.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
