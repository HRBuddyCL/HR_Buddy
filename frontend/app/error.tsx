"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[frontend] route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-10">
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Unexpected Error</p>
        <h1 className="mt-2 text-2xl font-semibold text-rose-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-rose-800">
          The page encountered an unexpected error. You can retry this action or return to a safe page.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-rose-800 ring-1 ring-rose-300 hover:bg-rose-100"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
