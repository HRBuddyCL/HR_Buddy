"use client";

import { useEffect } from "react";
import Link from "next/link";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({
  error,
  reset,
}: GlobalErrorPageProps) {
  useEffect(() => {
    console.error("[frontend] global error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="th">
      <body className="antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-10">
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
              ข้อผิดพลาดร้ายแรง
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-red-900">
              เกิดข้อผิดพลาดทั่วไป
            </h1>
            <p className="mt-2 text-sm text-red-800">
              แอปพลิเคชันพบข้อผิดพลาดที่ไม่คาดคิด
              คุณสามารถลองใหม่หรือกลับไปยังจุดเริ่มต้นที่ปลอดภัย
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
              >
                ลองใหม่
              </button>
              <Link
                href="/"
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-800 ring-1 ring-red-300 hover:bg-red-100"
              >
                กลับสู่หน้าหลัก
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
