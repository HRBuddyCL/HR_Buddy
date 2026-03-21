import Link from "next/link";
import { cookies } from "next/headers";

export default async function Page() {
  const cookieStore = await cookies();
  const requestNo = cookieStore.get("hrb_success_request_no")?.value;
  const attachments = cookieStore.get("hrb_success_attachments")?.value;

  return (
    <main className="relative min-h-[calc(100vh-140px)] w-full bg-[#f8fafc]">
      <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr,0.8fr] lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-[#0e2d4c]/12 bg-white shadow-[0_24px_48px_-28px_rgba(14,45,76,0.35)]">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#fed54f]/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-14 bottom-4 h-36 w-36 rounded-full bg-[#0e2d4c]/8 blur-2xl" />

          <div className="relative p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0e2d4c] text-[#fed54f] shadow-lg shadow-[#0e2d4c]/25">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b62026]">
                  Request Completed
                </p>
                <h1 className="mt-1 text-2xl font-bold text-[#0e2d4c] sm:text-3xl">
                  ส่งคำขอเรียบร้อยแล้ว
                </h1>
                <p className="mt-2 text-sm text-[#0e2d4c]/70">
                  ระบบได้รับข้อมูลของคุณแล้ว และกำลังดำเนินการตามขั้นตอน
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#0e2d4c]/12 bg-[#0e2d4c] px-5 py-4 shadow-md shadow-[#0e2d4c]/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fed54f]/85">
                หมายเลขคำขอของคุณ
              </p>
              <p className="mt-1.5 break-all font-mono text-2xl font-bold tracking-wide text-white">
                {requestNo ?? "-"}
              </p>
            </div>

            {attachments === "partial" ? (
              <p className="mt-4 rounded-xl border border-[#b62026]/15 bg-[#b62026]/[0.04] px-4 py-3 text-xs leading-relaxed text-[#0e2d4c]/72">
                คำขอถูกสร้างแล้ว แต่มีไฟล์บางส่วนที่อัปโหลดไม่สำเร็จ
                กรุณาตรวจสอบในเมนูคำขอของฉัน
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-[#0e2d4c]/12 bg-white p-6 shadow-[0_16px_36px_-28px_rgba(14,45,76,0.45)] sm:p-7">
          <h2 className="text-lg font-bold text-[#0e2d4c]">ขั้นตอนถัดไป</h2>
          <ol className="mt-4 space-y-3">
            {[
              "บันทึกหมายเลขคำขอไว้ เพื่อใช้อ้างอิงภายหลัง",
              "ยืนยันตัวตนด้วย OTP ก่อนเข้าหน้าติดตามผล",
              "ตรวจสอบความคืบหน้าได้ที่เมนู คำขอของฉัน",
            ].map((text, index) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0e2d4c] text-[11px] font-bold text-[#fed54f]">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-[#0e2d4c]/72">
                  {text}
                </p>
              </li>
            ))}
          </ol>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-[#0e2d4c]/12 to-transparent" />

          <div className="space-y-3">
            <Link
              href="/auth/otp"
              className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0e2d4c] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#0e2d4c]/20 transition-all duration-300 hover:-translate-y-px hover:shadow-[#0e2d4c]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2"
            >
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#fed54f]/90" />
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
                />
              </svg>
              ไปหน้าคำขอของฉัน
            </Link>

            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#0e2d4c]/15 bg-white px-5 py-3 text-sm font-semibold text-[#0e2d4c]/72 transition-all duration-200 hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c]/[0.03] hover:text-[#0e2d4c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2"
            >
              <svg
                className="h-4 w-4 shrink-0"
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
              กลับหน้าหลัก
            </Link>
          </div>

          <p className="mt-5 rounded-xl border border-[#b62026]/15 bg-[#b62026]/[0.04] px-4 py-3 text-xs leading-relaxed text-[#0e2d4c]/72">
            หากพบปัญหาในการติดตามสถานะ กรุณาติดต่อทีม HR พร้อมแจ้งหมายเลขคำขอ
          </p>
        </section>
      </div>
    </main>
  );
}
