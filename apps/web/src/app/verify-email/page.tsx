"use client";

import Link from "next/link";
import {
  useState,
  type FormEvent,
} from "react";
import { apiFetch } from "@/lib/api";

export default function VerifyEmailPage() {
  const [
    email,
    setEmail,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );

  async function resend(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setMessage(null);

    try {
      const response =
        await apiFetch<{
          message: string;
        }>(
          "/api/auth/resend-verification",
          {
            method: "POST",

            body:
              JSON.stringify({
                email,
              }),
          },
        );

      setMessage(
        response.message,
      );
    } catch {
      setMessage(
        "Could not request another verification email. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-slate-50 px-5 py-20">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">
          ✉
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">
          Check your email
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          We sent a verification link
          to the email address used to
          create your BLX Store account.
          Open that link to activate your
          account before signing in.
        </p>

        <p className="mt-3 text-xs leading-5 text-slate-400">
          The verification link expires
          after 30 minutes. Check your
          spam folder if you do not see
          the message.
        </p>

        <div className="my-8 border-t border-slate-200" />

        <p className="text-sm font-semibold text-slate-900">
          Need another email?
        </p>

        <form
          onSubmit={resend}
          className="mt-4 space-y-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value,
              )
            }
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={
              submitting
            }
            className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting
              ? "Sending..."
              : "Resend verification email"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {message}
          </p>
        )}

        <Link
          href="/login"
          className="mt-8 inline-flex text-sm font-semibold text-blue-600"
        >
          Go to sign in
        </Link>
      </div>
    </main>
  );
}
