"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import type { Category } from "@/lib/types";
import { useStore } from "./store-provider";

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
      />
      <path d="M5 20c.8-4 3-6 7-6s6.2 2 7 6" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H7" />
      <circle
        cx="10"
        cy="20"
        r="1"
      />
      <circle
        cx="17"
        cy="20"
        r="1"
      />
    </svg>
  );
}

export function SiteHeader() {
  const {
    user,
    authLoading,
    cartCount,
  } = useStore();

  const [
    categories,
    setCategories,
  ] = useState<Category[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response =
          await apiFetch<{
            categories: Category[];
          }>(
            "/api/catalog/categories",
          );

        if (cancelled) {
          return;
        }

        const uniqueCategories =
          Array.from(
            new Map(
              response.categories.map(
                (category) => [
                  category.slug,
                  category,
                ],
              ),
            ).values(),
          ).slice(0, 5);

        setCategories(
          uniqueCategories,
        );
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white">
      <div className="border-b border-slate-200">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 px-5 py-3 lg:gap-10 lg:px-8">
          <Link
            href="/"
            prefetch={false}
            aria-label="BLX Store home"
            className="flex items-center"
          >
            <Image
              src="/blx-logo.png"
              alt="BLX"
              width={150}
              height={48}
              priority
              className="h-auto w-[108px] sm:w-[125px] lg:w-[140px]"
            />
          </Link>

          <form
            action="/products"
            className="relative mx-auto w-full max-w-3xl"
          >
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>

            <input
              type="search"
              name="search"
              placeholder="Search notebooks, components, peripherals..."
              className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 pl-12 pr-4 text-sm text-slate-950 transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:bg-white"
            />
          </form>

          <div className="flex items-center justify-end gap-1 sm:gap-2">
            {!authLoading &&
              (user ? (
                <Link
                  href="/account"
                  prefetch={false}
                  aria-label={
                    user.fullName
                      ? `Account for ${user.fullName}`
                      : "Account"
                  }
                  title={
                    user.fullName ??
                    user.email
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold uppercase text-white shadow-sm transition hover:bg-blue-700 hover:ring-4 hover:ring-blue-100"
                >
                  {(
                    user.fullName
                      ?.trim()
                      .charAt(0) ||
                    user.email.charAt(0)
                  ).toUpperCase()}
                </Link>
              ) : (
                <Link
                  href="/login"
                  prefetch={false}
                  className="flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 sm:px-3"
                >
                  <UserIcon />

                  <span className="hidden lg:block">
                    Sign in
                  </span>
                </Link>
              ))}

            <Link
              href="/cart"
              prefetch={false}
              aria-label="Shopping cart"
              className="relative flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 sm:px-3"
            >
              <CartIcon />

              <span className="hidden lg:block">
                Cart
              </span>

              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  {cartCount > 99
                    ? "99+"
                    : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-5 py-2 lg:px-8">
          <Link
            href="/products"
            prefetch={false}
            className="whitespace-nowrap rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
          >
            All products
          </Link>

          {categories.map(
            (category) => (
              <Link
                key={category.slug}
                href={`/products?category=${category.slug}`}
                prefetch={false}
                className="whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {category.name}
              </Link>
            ),
          )}

          {user && (
            <Link
              href="/account/orders"
              prefetch={false}
              className="whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              My orders
            </Link>
          )}

          {user?.role ===
            "ADMIN" && (
            <Link
              href="/admin"
              prefetch={false}
              className="whitespace-nowrap rounded-md bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Admin
            </Link>
          )}

          <div className="ml-auto hidden whitespace-nowrap text-xs font-medium text-slate-400 xl:block">
            Secure shopping · Test environment
          </div>
        </div>
      </div>
    </header>
  );
}
