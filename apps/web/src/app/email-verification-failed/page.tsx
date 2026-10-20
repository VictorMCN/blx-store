import Link from "next/link";

export default function EmailVerificationFailedPage() {
  return (
    <main className="bg-slate-50 px-5 py-24">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-2xl text-rose-600">
          !
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">
          Verification link unavailable
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          This verification link is
          invalid, expired, or has
          already been used.
        </p>

        <Link
          href="/verify-email"
          className="mt-8 inline-flex rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
        >
          Request another email
        </Link>
      </div>
    </main>
  );
}
