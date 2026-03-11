import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          ไม่พบหน้า
        </h1>
        <p className="mt-2 text-sm text-slate-700">
          หน้าที่คุณกำลังมองหาไม่มีอยู่หรือลิงก์อาจไม่ถูกต้อง
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            กลับสู่หน้าแรก
          </Link>
          <Link
            href="/admin/login"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
          >
            ไปที่เข้าสู่ระบบผู้ดูแลระบบ
          </Link>
        </div>
      </section>
    </main>
  );
}
