import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="relative flex w-full flex-1 items-center overflow-hidden bg-[#f8fafc]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-rose-100/75 blur-3xl md:-left-24 md:h-72 md:w-72" />
        <div className="absolute -right-24 bottom-4 h-64 w-64 rounded-full bg-[#dbeafe]/80 blur-3xl md:-right-28 md:h-80 md:w-80" />
        <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fed54f]/10 blur-3xl md:h-72 md:w-72" />
      </div>

      <main className="relative mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
        <section className="relative overflow-hidden rounded-3xl border border-rose-200/80 bg-gradient-to-b from-rose-50 via-white to-white p-5 shadow-[0_24px_70px_-35px_rgba(190,24,93,0.45)] sm:p-7 md:rounded-[28px] md:p-10">
          <div className="pointer-events-none absolute -right-6 -top-8 text-[92px] font-black leading-none tracking-tighter text-rose-100/75 sm:-right-8 sm:-top-10 sm:text-[120px] md:-right-10 md:-top-12 md:text-[180px]">
            404
          </div>

          <div className="relative flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 ring-1 ring-rose-200 md:h-16 md:w-16">
              <svg
                className="h-6 w-6 md:h-7 md:w-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700 sm:text-sm sm:tracking-[0.14em]">
                404 - PAGE NOT FOUND
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-rose-900 sm:text-3xl md:text-[2.2rem]">
                อุ๊ปส์ ไม่พบหน้าที่คุณต้องการ
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-rose-800/90 sm:text-[15px] md:text-base">
                ลิงก์นี้อาจไม่ถูกต้อง หน้านี้อาจถูกย้าย หรือหมดอายุแล้ว
                คุณสามารถกลับไปยังหน้าหลักหรือไปยังจุดเริ่มต้นที่ต้องการได้ทันที
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-3">
                <Link
                  href="/"
                  className="w-full rounded-xl bg-[#c81e4b] px-5 py-3 text-center text-sm font-semibold text-white shadow-md shadow-rose-300/60 transition hover:-translate-y-px hover:bg-[#b51842] sm:w-auto sm:py-2.5"
                >
                  กลับหน้าหลัก
                </Link>
                <Link
                  href="/my-requests"
                  className="w-full rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-rose-800 ring-1 ring-rose-300 transition hover:bg-rose-100 sm:w-auto sm:py-2.5"
                >
                  ไปที่คำขอของฉัน
                </Link>
                <Link
                  href="/admin/login"
                  className="w-full rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-rose-800 ring-1 ring-rose-300 transition hover:bg-rose-100 sm:w-auto sm:py-2.5"
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
