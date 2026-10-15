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
      await login(email, password);
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
    <main className="mx-auto flex max-w-md px-5 py-16">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Welcome back
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Sign in to BLX Store
        </h1>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5"
        >
          <label className="block">
            <span className="text-sm font-medium">
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
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">
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
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-blue-500"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting
              ? "Signing in..."
              : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          New to BLX Store?{" "}
          <Link
            href="/register"
            className="font-semibold text-blue-600"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
