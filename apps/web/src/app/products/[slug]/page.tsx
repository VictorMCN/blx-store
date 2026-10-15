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

  const [selectedImage, setSelectedImage] =
    useState(0);

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
          setProduct(response.product);
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
            productId: product.id,
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
    product.images[selectedImage]
      ?.url ?? null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <Link
        href="/products"
        className="text-sm font-semibold text-blue-600"
      >
        ← Products
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <div
            className="aspect-square overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 bg-contain bg-center bg-no-repeat"
            style={
              image
                ? {
                    backgroundImage: `url("${image}")`,
                  }
                : undefined
            }
          >
            {!image && (
              <div className="flex h-full items-center justify-center font-medium text-slate-400">
                BLX Product
              </div>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto">
              {product.images.map(
                (item, index) => (
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
                    className={`h-20 w-20 shrink-0 rounded-xl border bg-slate-100 bg-cover bg-center ${
                      selectedImage ===
                      index
                        ? "border-blue-500"
                        : "border-slate-200"
                    }`}
                    style={{
                      backgroundImage: `url("${item.url}")`,
                    }}
                    aria-label={`View product image ${index + 1}`}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <div className="lg:py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            {product.category.name}
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            {product.name}
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            SKU {product.sku}
          </p>

          <p className="mt-7 text-3xl font-bold">
            {formatMoney(
              product.priceInCents,
              product.currency,
            )}
          </p>

          <p
            className={`mt-2 text-sm font-semibold ${
              product.availability.inStock
                ? "text-emerald-600"
                : "text-rose-600"
            }`}
          >
            {product.availability.inStock
              ? "Available now"
              : "Currently out of stock"}
          </p>

          <div className="mt-8 border-t border-slate-200 pt-8">
            <h2 className="font-semibold">
              Product details
            </h2>

            <p className="mt-3 whitespace-pre-line leading-7 text-slate-600">
              {product.description}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                Quantity
              </span>

              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    Math.max(
                      1,
                      Math.min(
                        99,
                        Number(
                          event.target
                            .value,
                        ) || 1,
                      ),
                    ),
                  )
                }
                className="w-20 rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <button
              type="button"
              onClick={() =>
                void addToCart()
              }
              disabled={
                adding ||
                !product.availability.inStock
              }
              className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:bg-slate-300"
            >
              {adding
                ? "Adding..."
                : "Add to cart"}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-rose-600">
              {error}
            </p>
          )}
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
