"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { ProductCard } from "@/components/product-card";
import { apiFetch } from "@/lib/api";
import type {
  CatalogResponse,
  Category,
} from "@/lib/types";

export default function Home() {
  const [products, setProducts] =
    useState<CatalogResponse["products"]>(
      [],
    );

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [
          productResponse,
          categoryResponse,
        ] = await Promise.all([
          apiFetch<CatalogResponse>(
            "/api/catalog/products?inStock=true&sort=newest&limit=8",
          ),
          apiFetch<{
            categories: Category[];
          }>("/api/catalog/categories"),
        ]);

        if (!cancelled) {
          setProducts(
            productResponse.products,
          );

          setCategories(
            categoryResponse.categories,
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
  }, []);

  return (
    <main>
      <div className="border-b border-blue-100 bg-blue-50">
        <div className="mx-auto max-w-[1440px] px-5 py-2.5 text-center text-xs font-medium text-blue-800 lg:px-8">
          Secure test checkout · Inventory
          reservations · Order tracking
        </div>
      </div>

      <section className="border-b border-slate-200">
        <div className="mx-auto grid max-w-[1440px] gap-14 px-5 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-blue-600">
              BLX Store
            </p>

            <h1 className="mt-4 text-5xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl">
              Technology without the noise.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-500">
              Computers, components and
              peripherals selected for
              productivity, development and
              entertainment.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                Explore products
              </Link>

              <Link
                href="/products?inStock=true"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Available now
              </Link>
            </div>
          </div>

          <div className="relative min-h-[390px] overflow-hidden rounded-2xl bg-[#f4f5f7]">
            <div className="absolute inset-x-8 top-8 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  BLX Selection
                </p>

                <p className="mt-1 text-xl font-semibold text-slate-900">
                  Built for your setup
                </p>
              </div>

              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm">
                2026
              </span>
            </div>

            <div className="absolute bottom-8 left-8 right-8 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  Workstations
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Reliable hardware for
                  productivity.
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-5 text-white shadow-sm">
                <p className="text-sm font-semibold">
                  Components
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Upgrade performance with
                  confidence.
                </p>
              </div>

              <div className="col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Shopping engineered
                    beyond the interface.
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Secure checkout and
                    inventory protection.
                  </p>
                </div>

                <div className="h-10 w-10 rounded-full bg-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200">
        <div className="mx-auto max-w-[1440px] px-5 py-12 lg:px-8">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-blue-600">
                Categories
              </p>

              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Shop by category
              </h2>
            </div>

            <Link
              href="/products"
              className="hidden text-sm font-semibold text-slate-600 transition hover:text-blue-600 sm:block"
            >
              View catalog →
            </Link>
          </div>

          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {categories
              .slice(0, 8)
              .map((category) => (
                <Link
                  key={category.id}
                  href={`/products?category=${category.slug}`}
                  className="group bg-white p-6 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 transition group-hover:text-blue-600">
                        {category.name}
                      </h3>

                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                        {category.description ??
                          "Explore products in this category."}
                      </p>
                    </div>

                    <span className="text-xs font-medium text-slate-400">
                      {category.productCount}
                    </span>
                  </div>

                  <p className="mt-5 text-xs font-semibold text-slate-400 transition group-hover:text-blue-600">
                    Explore →
                  </p>
                </Link>
              ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-14 lg:px-8 lg:py-16">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Latest arrivals
            </p>

            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Products ready for your setup
            </h2>
          </div>

          <Link
            href="/products"
            className="text-sm font-semibold text-slate-600 transition hover:text-blue-600"
          >
            See all →
          </Link>
        </div>

        {loading ? (
          <div className="mt-9 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({
              length: 4,
            }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse"
              >
                <div className="aspect-square rounded-xl bg-slate-100" />
                <div className="mt-4 h-4 w-2/3 rounded bg-slate-100" />
                <div className="mt-2 h-4 w-full rounded bg-slate-100" />
                <div className="mt-5 h-6 w-1/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mt-9 border-t border-slate-200 py-16 text-center text-sm text-slate-500">
            No products are available yet.
          </div>
        ) : (
          <div className="mt-9 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-[1440px] divide-y divide-slate-200 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-8">
          <div className="py-8 sm:px-8 sm:first:pl-0">
            <p className="text-sm font-semibold text-slate-900">
              Secure payments
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Provider-backed checkout with
              signed payment events.
            </p>
          </div>

          <div className="py-8 sm:px-8">
            <p className="text-sm font-semibold text-slate-900">
              Protected inventory
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Stock reservations reduce
              overselling during checkout.
            </p>
          </div>

          <div className="py-8 sm:px-8 sm:last:pr-0">
            <p className="text-sm font-semibold text-slate-900">
              Order tracking
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Follow every order through the
              fulfillment workflow.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
