"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useStore } from "./store-provider";

export function ProductCard({
  product,
}: {
  product: Product;
}) {
  const router = useRouter();

  const {
    user,
    refreshCart,
  } = useStore();

  const [adding, setAdding] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const image =
    product.images[0]?.url ?? null;

  const specificationSummary =
    product.description
      .split("\n")[0]
      ?.trim();

  async function addToCart() {
    if (!user) {
      router.push("/login");
      return;
    }

    setAdding(true);
    setMessage(null);

    try {
      await apiFetch(
        "/api/cart/items",
        {
          method: "POST",
          body: JSON.stringify({
            productId:
              product.id,
            quantity: 1,
          }),
        },
      );

      await refreshCart();

      setMessage(
        "Added to cart",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not add product.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="group flex min-w-0 flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="relative block overflow-hidden rounded-xl bg-[#f5f6f7]"
      >
        <div
          className="aspect-square bg-contain bg-center bg-no-repeat p-6 transition duration-300 group-hover:scale-[1.025]"
          style={
            image
              ? {
                  backgroundImage: `url("${image}")`,
                }
              : undefined
          }
        >
          {!image && (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-300">
              BLX
            </div>
          )}
        </div>

        {!product.availability
          .inStock && (
          <span className="absolute left-3 top-3 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {product.category.name}
        </p>

        <Link
          href={`/products/${product.slug}`}
          className="mt-1.5 line-clamp-2 min-h-11 text-sm font-semibold leading-[1.45] text-slate-800 transition hover:text-blue-600"
        >
          {product.name}
        </Link>

        <p className="mt-1 text-xs text-slate-400">
          SKU {product.sku}
        </p>

        {specificationSummary && (
          <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
            {specificationSummary}
          </p>
        )}

        <div className="mt-auto pt-4">
          <p className="text-xl font-bold tracking-tight text-slate-950">
            {formatMoney(
              product.priceInCents,
              product.currency,
            )}
          </p>

          <p
            className={`mt-1 text-xs font-medium ${
              product.availability
                .inStock
                ? "text-emerald-600"
                : "text-slate-400"
            }`}
          >
            {product.availability
              .inStock
              ? "In stock"
              : "Currently unavailable"}
          </p>

          <button
            type="button"
            onClick={() =>
              void addToCart()
            }
            disabled={
              adding ||
              !product.availability
                .inStock
            }
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {adding
              ? "Adding..."
              : "Add to cart"}
          </button>

          {message && (
            <p className="mt-2 text-xs text-slate-500">
              {message}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
