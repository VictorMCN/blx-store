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
import { useStore } from "@/components/store-provider";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

function ProductDetailContent() {
  const params =
    useParams<{
      slug: string;
    }>();

  const router = useRouter();

  const {
    user,
    refreshCart,
  } = useStore();

  const [product, setProduct] =
    useState<Product | null>(null);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState(0);

  const [quantity, setQuantity] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [adding, setAdding] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response =
          await apiFetch<{
            product: Product;
          }>(
            `/api/catalog/products/${encodeURIComponent(
              params.slug,
            )}`,
          );

        if (!cancelled) {
          setProduct(
            response.product,
          );

          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load product.",
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
  }, [params.slug]);

  async function addToCart() {
    if (!product) {
      return;
    }

    if (!user) {
      router.push("/login");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      await apiFetch(
        "/api/cart/items",
        {
          method: "POST",
          body: JSON.stringify({
            productId:
              product.id,
            quantity,
          }),
        },
      );

      await refreshCart();

      router.push("/cart");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not add product.",
      );
    } finally {
      setAdding(false);
    }
  }

  function decreaseQuantity() {
    setQuantity((current) =>
      Math.max(
        1,
        current - 1,
      ),
    );
  }

  function increaseQuantity() {
    setQuantity((current) =>
      Math.min(
        99,
        current + 1,
      ),
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <p className="text-slate-500">
          Loading product...
        </p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <h1 className="text-2xl font-bold">
          Product unavailable
        </h1>

        <p className="mt-3 text-slate-600">
          {error ??
            "This product could not be found."}
        </p>

        <Link
          href="/products"
          className="mt-6 inline-flex text-sm font-semibold text-blue-600"
        >
          ← Back to products
        </Link>
      </main>
    );
  }

  const image =
    product.images[
      selectedImage
    ]?.url ?? null;

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Link
            href="/"
            className="transition hover:text-blue-600"
          >
            Home
          </Link>

          <span>/</span>

          <Link
            href="/products"
            className="transition hover:text-blue-600"
          >
            Products
          </Link>

          <span>/</span>

          <span className="text-slate-600">
            {product.category.name}
          </span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.92fr)] lg:gap-16">
          <section>
            <div
              className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-[#f6f7f8] bg-contain bg-center bg-no-repeat"
              style={
                image
                  ? {
                      backgroundImage: `url("${image}")`,
                    }
                  : undefined
              }
            >
              {!image && (
                <div className="flex h-full items-center justify-center text-lg font-semibold text-slate-300">
                  BLX Product
                </div>
              )}

              {product.availability
                .inStock && (
                <span className="absolute left-4 top-4 rounded-lg border border-emerald-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
                  In stock
                </span>
              )}
            </div>

            {product.images.length >
              1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {product.images.map(
                  (
                    item,
                    index,
                  ) => (
                    <button
                      key={
                        item.id ??
                        `${item.url}-${index}`
                      }
                      type="button"
                      onClick={() =>
                        setSelectedImage(
                          index,
                        )
                      }
                      className={`h-20 w-20 shrink-0 rounded-xl border bg-[#f6f7f8] bg-contain bg-center bg-no-repeat transition ${
                        selectedImage ===
                        index
                          ? "border-blue-500 ring-2 ring-blue-500/10"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                      style={{
                        backgroundImage: `url("${item.url}")`,
                      }}
                      aria-label={`View product image ${
                        index + 1
                      }`}
                    />
                  ),
                )}
              </div>
            )}
          </section>

          <section className="lg:py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              {
                product.category
                  .name
              }
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
              {product.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
              <span>
                SKU {product.sku}
              </span>

              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />

              <span>
                BLX Store catalog
              </span>
            </div>

            <div className="mt-8 border-y border-slate-200 py-6">
              <p className="text-sm text-slate-500">
                Price
              </p>

              <p className="mt-1 text-4xl font-bold tracking-[-0.035em] text-slate-950">
                {formatMoney(
                  product.priceInCents,
                  product.currency,
                )}
              </p>

              <p
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  product.availability
                    .inStock
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {product.availability
                  .inStock
                  ? "Available for purchase"
                  : "Currently out of stock"}
              </p>
            </div>

            <div className="mt-7">
              <h2 className="text-sm font-semibold text-slate-900">
                About this product
              </h2>

              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {product.description}
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-[#fafafa] p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Quantity
                  </p>

                  <div className="mt-2 inline-flex h-11 items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
                    <button
                      type="button"
                      onClick={
                        decreaseQuantity
                      }
                      disabled={
                        quantity <= 1
                      }
                      className="h-full w-11 text-lg text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>

                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={quantity}
                      onChange={(
                        event,
                      ) =>
                        setQuantity(
                          Math.max(
                            1,
                            Math.min(
                              99,
                              Number(
                                event
                                  .target
                                  .value,
                              ) ||
                                1,
                            ),
                          ),
                        )
                      }
                      className="h-full w-14 border-x border-slate-200 bg-white text-center text-sm font-semibold outline-none"
                      aria-label="Product quantity"
                    />

                    <button
                      type="button"
                      onClick={
                        increaseQuantity
                      }
                      disabled={
                        quantity >= 99
                      }
                      className="h-full w-11 text-lg text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void addToCart()
                  }
                  disabled={
                    adding ||
                    !product
                      .availability
                      .inStock
                  }
                  className="h-12 flex-1 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {adding
                    ? "Adding to cart..."
                    : product
                          .availability
                          .inStock
                      ? "Add to cart"
                      : "Out of stock"}
                </button>
              </div>

              {error && (
                <p className="mt-4 text-sm text-rose-600">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Secure payment
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Checkout payments are
                  processed through
                  Stripe.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Order history
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Purchase and payment
                  status remain available
                  in your account.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <p className="text-slate-500">
            Loading product...
          </p>
        </main>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}
