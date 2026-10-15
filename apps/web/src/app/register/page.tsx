"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import { useStore } from "@/components/store-provider";

export default function RegisterPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
    register,
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
      await register(
        email,
        password,
      );

      router.push("/account");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create account.",
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
              Join BLX Store
            </p>

            <h1 className="mt-5 max-w-xl text-5xl font-semibold tracking-[-0.04em] text-slate-950">
              Create an account built
              around a simpler checkout.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
              Register once, complete your
              customer information and
              keep your purchases,
              addresses and payments
              organized.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-900">
              After registration
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold text-blue-600">
                  01
                </p>

                <p className="mt-2 text-sm font-semibold">
                  Complete profile
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-blue-600">
                  02
                </p>

                <p className="mt-2 text-sm font-semibold">
                  Add address
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-blue-600">
                  03
                </p>

                <p className="mt-2 text-sm font-semibold">
                  Checkout securely
                </p>
              </div>
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
                Get started
              </p>

              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Create your account
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Customer and shipping
                information can be
                completed after
                registration.
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
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  placeholder="At least 8 characters"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />

                <span className="mt-2 block text-xs text-slate-400">
                  Minimum 8 characters.
                </span>
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
                  ? "Creating account..."
                  : "Create account"}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-sm text-slate-600">
                Already registered?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-blue-600 hover:text-blue-500"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
