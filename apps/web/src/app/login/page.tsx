"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import { useStore } from "@/components/store-provider";

export default function LoginPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
    login,
  } = useStore();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/account");
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  async function submit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      await login(
        email,
        password,
      );

      router.push("/account");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not sign in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-[#f6f7f8]">
      <div className="mx-auto grid min-h-[680px] max-w-7xl lg:grid-cols-[1fr_520px]">
        <section className="hidden flex-col justify-between px-10 py-16 lg:flex xl:px-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
              BLX Store account
            </p>

            <h1 className="mt-5 max-w-xl text-5xl font-semibold tracking-[-0.04em] text-slate-950">
              Everything about your
              purchases in one place.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
              Sign in to manage your
              customer profile, shipping
              addresses, pending payments
              and order history.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">
                Secure checkout
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Payments are handled
                securely through Stripe.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">
                Order tracking
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Follow the complete status
                of every purchase.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">
                Saved account
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Keep your profile and
                addresses ready for
                checkout.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center px-5 py-12 sm:px-8 lg:border-l lg:border-slate-200 lg:bg-white lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <Link
              href="/"
              className="text-sm font-semibold text-slate-500 transition hover:text-blue-600"
            >
              ← Back to store
            </Link>

            <div className="mt-8">
              <p className="text-sm font-semibold text-blue-600">
                Welcome back
              </p>

              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Sign in to BLX Store
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Access your account,
                orders and checkout
                information.
              </p>
            </div>

            <form
              onSubmit={submit}
              className="mt-8 space-y-5"
            >
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Email
                </span>

                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Password
                </span>

                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Enter your password"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Signing in..."
                  : "Sign in"}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-sm text-slate-600">
                New to BLX Store?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-blue-600 hover:text-blue-500"
                >
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
