import Link from "next/link";

type PageProps = {
  params: Promise<{ requestNo: string }>;
};

export default async function Page({ params }: PageProps) {
  const { requestNo } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-10">
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Request submitted</p>
        <h1 className="mt-2 text-3xl font-semibold text-emerald-900">Success</h1>
        <p className="mt-3 text-emerald-800">
          Your request number is <span className="font-semibold">{requestNo}</span>.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Next step</h2>
        <p className="mt-2 text-sm text-slate-700">
          Keep this request number. You can track status from My Requests after verifying OTP.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/auth/otp"
            className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Go to OTP
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
