"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { apiFetch } from "@/lib/api";
import type {
  CatalogResponse,
  Category,
} from "@/lib/types";

function ProductsContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const queryString =
    searchParams.toString();

  const currentSearch =
    searchParams.get("search") ?? "";

  const currentCategory =
    searchParams.get("category") ?? "";

  const currentInStock =
    searchParams.get("inStock") ===
    "true";

  const currentSort =
    searchParams.get("sort") ??
    "newest";

  const currentMinPrice =
    searchParams.get(
      "minPriceInCents",
    ) ?? "";

  const currentMaxPrice =
    searchParams.get(
      "maxPriceInCents",
    ) ?? "";

  const currentPage =
    Number(
      searchParams.get("page") ??
        "1",
    ) || 1;

  const [catalog, setCatalog] =
    useState<CatalogResponse | null>(
      null,
    );

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  function updateQuery(
    updates: Record<
      string,
      string | null
    >,
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString(),
      );

    Object.entries(updates).forEach(
      ([key, value]) => {
        if (
          value === null ||
          value === ""
        ) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      },
    );

    router.push(
      params.size > 0
        ? `/products?${params.toString()}`
        : "/products",
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response =
          await apiFetch<{
            categories: Category[];
          }>("/api/catalog/categories");

        if (!cancelled) {
          setCategories(
            response.categories,
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load categories.",
          );
        }
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const response =
          await apiFetch<CatalogResponse>(
            queryString
              ? `/api/catalog/products?${queryString}`
              : "/api/catalog/products",
          );

        if (!cancelled) {
          setCatalog(response);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load products.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timeout =
      window.setTimeout(() => {
        if (!cancelled) {
          setLoading(true);
          void loadProducts();
        }
      }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [queryString]);

  function submitSearch(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      new FormData(event.currentTarget);

    updateQuery({
      search:
        String(
          form.get("search") ?? "",
        ).trim() || null,
      page: null,
    });
  }

  function submitPrice(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      new FormData(event.currentTarget);

    const min =
      String(
        form.get("minPrice") ?? "",
      ).trim();

    const max =
      String(
        form.get("maxPrice") ?? "",
      ).trim();

    updateQuery({
      minPriceInCents: min
        ? String(
            Math.round(
              Number(min) * 100,
            ),
          )
        : null,

      maxPriceInCents: max
        ? String(
            Math.round(
              Number(max) * 100,
            ),
          )
        : null,

      page: null,
    });
  }

  return (
    <main className="min-h-[70vh] bg-[#f6f7f8]">
      <div className="mx-auto max-w-[1440px] px-5 py-9 lg:px-8">
        <div className="mb-7">
          <p className="text-xs font-medium text-slate-400">
            Home / Products
          </p>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Products
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {catalog
                  ? `${catalog.pagination.total} products available`
                  : "Browse the BLX catalog"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="h-fit rounded-xl border border-slate-200 bg-white lg:sticky lg:top-36">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">
                Filters
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/products",
                  )
                }
                className="text-xs font-semibold text-blue-600 hover:text-blue-500"
              >
                Clear
              </button>
            </div>

            <div className="border-b border-slate-200 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Category
              </p>

              <div className="mt-3 space-y-2.5">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="category"
                    checked={
                      !currentCategory
                    }
                    onChange={() =>
                      updateQuery({
                        category:
                          null,
                        page: null,
                      })
                    }
                  />

                  All products
                </label>

                {categories.map(
                  (item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center justify-between gap-2 text-sm text-slate-600"
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="category"
                          checked={
                            currentCategory ===
                            item.slug
                          }
                          onChange={() =>
                            updateQuery({
                              category:
                                item.slug,
                              page: null,
                            })
                          }
                        />

                        {item.name}
                      </span>

                      <span className="text-xs text-slate-400">
                        {
                          item.productCount
                        }
                      </span>
                    </label>
                  ),
                )}
              </div>
            </div>

            <div className="border-b border-slate-200 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Availability
              </p>

              <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={
                    currentInStock
                  }
                  onChange={(event) =>
                    updateQuery({
                      inStock:
                        event.target
                          .checked
                          ? "true"
                          : null,
                      page: null,
                    })
                  }
                />

                In stock only
              </label>
            </div>

            <form
              onSubmit={submitPrice}
              className="px-5 py-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Price
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  name="minPrice"
                  type="number"
                  min={0}
                  defaultValue={
                    currentMinPrice
                      ? Number(
                          currentMinPrice,
                        ) / 100
                      : ""
                  }
                  placeholder="Min"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />

                <input
                  name="maxPrice"
                  type="number"
                  min={0}
                  defaultValue={
                    currentMaxPrice
                      ? Number(
                          currentMaxPrice,
                        ) / 100
                      : ""
                  }
                  placeholder="Max"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-950"
              >
                Apply price
              </button>
            </form>
          </aside>

          <section className="min-w-0">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <form
                onSubmit={submitSearch}
                className="flex min-w-0 flex-1 gap-2"
              >
                <input
                  name="search"
                  defaultValue={
                    currentSearch
                  }
                  placeholder="Search catalog"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:bg-white"
                />

                <button
                  type="submit"
                  className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  Search
                </button>
              </form>

              <select
                value={currentSort}
                onChange={(event) =>
                  updateQuery({
                    sort:
                      event.target
                        .value ===
                      "newest"
                        ? null
                        : event.target
                            .value,
                    page: null,
                  })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600"
              >
                <option value="newest">
                  Newest
                </option>

                <option value="price_asc">
                  Price: low to high
                </option>

                <option value="price_desc">
                  Price: high to low
                </option>

                <option value="name_asc">
                  Name: A-Z
                </option>

                <option value="name_desc">
                  Name: Z-A
                </option>
              </select>
            </div>

            {error && (
              <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="mt-6 grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({
                  length: 8,
                }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="animate-pulse"
                    >
                      <div className="aspect-square rounded-xl bg-slate-200" />

                      <div className="mt-4 h-4 w-3/4 rounded bg-slate-200" />

                      <div className="mt-2 h-4 rounded bg-slate-200" />

                      <div className="mt-5 h-6 w-1/3 rounded bg-slate-200" />
                    </div>
                  ),
                )}
              </div>
            ) : catalog &&
              catalog.products.length >
                0 ? (
              <>
                <div className="mt-6 grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
                  {catalog.products.map(
                    (product) => (
                      <ProductCard
                        key={product.id}
                        product={
                          product
                        }
                      />
                    ),
                  )}
                </div>

                <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6">
                  <p className="text-xs text-slate-500">
                    Page{" "}
                    {catalog.pagination.page}{" "}
                    of{" "}
                    {Math.max(
                      catalog.pagination
                        .totalPages,
                      1,
                    )}
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={
                        !catalog
                          .pagination
                          .hasPreviousPage
                      }
                      onClick={() =>
                        updateQuery({
                          page:
                            currentPage >
                            2
                              ? String(
                                  currentPage -
                                    1,
                                )
                              : null,
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      disabled={
                        !catalog
                          .pagination
                          .hasNextPage
                      }
                      onClick={() =>
                        updateQuery({
                          page: String(
                            currentPage +
                              1,
                          ),
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-20 text-center">
                <p className="font-semibold text-slate-800">
                  No products found
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Try changing your
                  search or filters.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[60vh] bg-[#f6f7f8] px-5 py-12">
          <p className="mx-auto max-w-[1440px] text-sm text-slate-500">
            Loading catalog...
          </p>
        </main>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
