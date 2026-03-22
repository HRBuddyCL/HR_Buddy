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
    <div className="relative flex w-full flex-1 items-center overflow-hidden bg-[#f8fafc]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-8 h-56 w-56 rounded-full bg-rose-100/70 blur-3xl" />
        <div className="absolute -right-24 bottom-8 h-64 w-64 rounded-full bg-[#dbeafe]/70 blur-3xl" />
      </div>

      <main className="relative mx-auto w-full max-w-3xl px-6 py-8 md:py-10">
        <section className="rounded-3xl border border-rose-200/80 bg-gradient-to-b from-rose-50 to-white p-7 shadow-[0_20px_50px_-28px_rgba(190,24,93,0.4)] md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 ring-1 ring-rose-200">
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
                  d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-rose-700">
                เกิดข้อผิดพลาดที่ไม่คาดคิด
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight text-rose-900 md:text-[2.05rem]">
                ระบบพบปัญหาระหว่างการทำงาน
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-rose-800/90">
                หน้านี้เกิดข้อผิดพลาดที่ไม่คาดคิด
                คุณสามารถลองทำรายการนี้ใหม่อีกครั้ง หรือกลับไปยังหน้าที่ปลอดภัย
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl bg-[#c81e4b] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-300/60 transition hover:-translate-y-px hover:bg-[#b51842]"
                >
                  ลองอีกครั้ง
                </button>
                <Link
                  href="/"
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-rose-800 ring-1 ring-rose-300 transition hover:bg-rose-100"
                >
                  กลับหน้าหลัก
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
