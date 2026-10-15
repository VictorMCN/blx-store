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
    <main className="mx-auto flex max-w-md px-5 py-16">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Get started
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Create your account
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your customer profile and shipping
          information can be completed after
          registration.
        </p>

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
              minLength={8}
              autoComplete="new-password"
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
              ? "Creating account..."
              : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already registered?{" "}
          <Link
            href="/login"
            className="font-semibold text-blue-600"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
