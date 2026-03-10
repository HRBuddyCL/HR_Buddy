import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-10">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">403</p>
        <h1 className="mt-2 text-2xl font-semibold text-amber-900">Unauthorized access</h1>
        <p className="mt-2 text-sm text-amber-800">
          You are signed in, but your account does not have permission to open this page.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            Back to home
          </Link>
          <Link
            href="/admin/login"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100"
          >
            Sign in as admin
          </Link>
        </div>
      </section>
    </main>
  );
}
