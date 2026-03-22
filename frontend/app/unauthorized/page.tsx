import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="relative flex w-full flex-1 items-center overflow-hidden bg-[#f8fafc]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-6 h-52 w-52 rounded-full bg-amber-100/70 blur-3xl" />
        <div className="absolute -right-24 bottom-8 h-64 w-64 rounded-full bg-[#dbeafe]/70 blur-3xl" />
      </div>

      <main className="relative mx-auto w-full max-w-3xl px-6 py-8 md:py-10">
        <section className="rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-white p-7 shadow-[0_20px_50px_-28px_rgba(180,83,9,0.4)] md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3.5c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-700">
                403 - ACCESS DENIED
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight text-amber-900 md:text-[2.05rem]">
                ไม่มีสิทธิ์เข้าถึงหน้านี้
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-amber-800/90">
                คุณเข้าสู่ระบบแล้ว แต่บัญชีของคุณไม่มีสิทธิ์ในการเปิดหน้านี้
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-300/60 transition hover:-translate-y-px hover:bg-amber-800"
                >
                  กลับหน้าหลัก
                </Link>
                <Link
                  href="/admin/login"
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-300 transition hover:bg-amber-100"
                >
                  เข้าสู่ระบบผู้ดูแล
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
