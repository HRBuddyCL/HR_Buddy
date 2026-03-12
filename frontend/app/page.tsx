import Link from "next/link";

type RequestType = {
  path: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  accentColor: string;
};

const requestTypes: RequestType[] = [
  {
    path: "/requests/new/building",
    title: "คำขอซ่อมแซมอาคาร",
    description: "ส่งคำขอซ่อมแซมหรือปรับปรุงอาคารสำนักงาน",
    icon: "🏢",
    color: "from-[#0e2d4c] to-[#1a4a7a]",
    accentColor: "border-[#0e2d4c]",
  },
  {
    path: "/requests/new/vehicle",
    title: "คำขอซ่อมรถยนต์",
    description: "ส่งคำขอซ่อมแซมหรือบริการรถยนต์บริษัท",
    icon: "🚗",
    color: "from-[#b62026] to-[#d63338]",
    accentColor: "border-[#b62026]",
  },
  {
    path: "/requests/new/messenger",
    title: "คำขอใช้บริการ Messenger",
    description: "ขอใช้บริการส่งเอกสารหรือพัสดุภายในบริษัท",
    icon: "📬",
    color: "from-[#0e2d4c] to-[#1a4a7a]",
    accentColor: "border-[#0e2d4c]",
  },
  {
    path: "/requests/new/document",
    title: "คำขอเอกสาร",
    description: "ขอเอกสารต่างๆ เช่น ใบรับรอง ใบลา เป็นต้น",
    icon: "📄",
    color: "from-[#b62026] to-[#d63338]",
    accentColor: "border-[#b62026]",
  },
];

const steps = [
  {
    step: "01",
    title: "เลือกประเภทคำขอ",
    desc: "เลือกประเภทคำขอที่ตรงกับความต้องการของคุณ",
    icon: "🎯",
    bg: "bg-[#0e2d4c]",
  },
  {
    step: "02",
    title: "กรอกข้อมูล",
    desc: "กรอกรายละเอียดคำขอให้ครบถ้วนและชัดเจน",
    icon: "✏️",
    bg: "bg-[#b62026]",
  },
  {
    step: "03",
    title: "ติดตามสถานะ",
    desc: "ตรวจสอบสถานะคำขอของคุณได้แบบเรียลไทม์",
    icon: "📊",
    bg: "bg-[#0e2d4c]",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      {/* ═══════════════════════════════
          HERO
      ═══════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#0e2d4c]">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0 select-none">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#b62026]/10 blur-3xl sm:h-[440px] sm:w-[440px]" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#fed54f]/8 blur-3xl sm:h-80 sm:w-80" />
        </div>

        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative mx-auto max-w-4xl px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
          {/* Badge */}
          <div className="mb-5 flex justify-center sm:mb-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#fed54f]/30 bg-[#fed54f]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#fed54f]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fed54f]" />
              Construction Lines HR System
            </span>
          </div>

          {/* Headline */}
          <h1 className="mb-4 text-center text-[2rem] font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            ยินดีต้อนรับสู่{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-[#fed54f]">HR Buddy</span>
              <span className="absolute inset-x-0 -bottom-0.5 h-[3px] rounded-full bg-[#b62026]" />
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-center text-sm leading-relaxed text-white/60 sm:text-base sm:mb-10">
            ระบบจัดการคำขอและบริการสำหรับพนักงาน
            ส่งคำขอได้ง่ายดายและติดตามสถานะได้แบบเรียลไทม์
          </p>

          {/* CTA */}
          <div className="flex justify-center">
            <Link
              href="/my-requests"
              className="group relative inline-flex w-full max-w-xs items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-[#b62026] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#b62026]/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#b62026]/40 sm:w-auto"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              <svg
                className="relative h-[18px] w-[18px] shrink-0"
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
              <span className="relative">ดูคำขอของฉันทั้งหมด</span>
              <svg
                className="relative h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>

        {/* Wave divider */}
        <div
          className="absolute inset-x-0 bottom-0 h-6 bg-[#f8fafc] sm:h-8"
          style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }}
        />
      </section>

      {/* ═══════════════════════════════
          SERVICE CARDS
      ═══════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#b62026]">
            บริการของเรา
          </p>
          <div className="flex items-end gap-4">
            <h2 className="text-xl font-bold text-[#0e2d4c] sm:text-3xl">
              เลือกประเภทคำขอ
            </h2>
            <div className="mb-1 hidden h-[2px] flex-1 rounded-full bg-gradient-to-r from-[#0e2d4c]/15 via-[#b62026]/20 to-transparent sm:block" />
          </div>
        </div>

        {/* Mobile: vertical list — Tablet+: 2-col — Desktop: 4-col */}
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {requestTypes.map((req) => (
            <Link
              key={req.path}
              href={req.path}
              className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f]"
            >
              {/* Accent bar */}
              <div
                className={`h-1 w-full bg-gradient-to-r ${req.color} sm:h-1.5`}
              />

              {/* ── Mobile layout: horizontal ── */}
              <div className="flex items-center gap-4 p-4 sm:hidden">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${req.color} shadow-md`}
                >
                  <span className="text-xl">{req.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold leading-snug text-[#0e2d4c] transition-colors group-hover:text-[#b62026]">
                    {req.title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 line-clamp-2">
                    {req.description}
                  </p>
                </div>
                <svg
                  className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#b62026]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>

              {/* ── Tablet/Desktop layout: vertical ── */}
              <div className="hidden flex-col p-6 sm:flex">
                <div
                  className={`mb-4 inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${req.color} shadow-md`}
                >
                  <span className="text-2xl">{req.icon}</span>
                </div>
                <h3 className="mb-2 text-[15px] font-bold leading-snug text-[#0e2d4c] transition-colors group-hover:text-[#b62026]">
                  {req.title}
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-slate-500">
                  {req.description}
                </p>
                <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-all duration-200 group-hover:gap-2.5 group-hover:text-[#b62026]">
                  ส่งคำขอ
                  <svg
                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>

              {/* Hover ring */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-2 ring-inset ring-[#b62026]/25 transition-opacity duration-300 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════ */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          {/* Header */}
          <div className="mb-10 text-center">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#b62026]">
              ขั้นตอนการใช้งาน
            </p>
            <h2 className="text-xl font-bold text-[#0e2d4c] sm:text-3xl">
              ง่ายแค่ 3 ขั้นตอน
            </h2>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:gap-8">
            {/* Mobile: horizontal card — Desktop: vertical centered */}
            {steps.map((item, idx) => (
              <div key={item.step}>
                {/* ── Mobile card ── */}
                <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-[#f8fafc] p-4 sm:hidden">
                  <div
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.bg} shadow-md`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#fed54f] text-[9px] font-black text-[#0e2d4c]">
                      {item.step}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-1 text-sm font-bold text-[#0e2d4c]">
                      {item.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-500">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {/* ── Desktop vertical ── */}
                <div className="group hidden flex-col items-center text-center sm:flex">
                  {/* Circle + connector wrapper */}
                  <div className="relative mb-5 flex w-full items-center justify-center">
                    {/* Left connector */}
                    {idx !== 0 && (
                      <div className="absolute right-1/2 top-1/2 mr-8 h-[2px] w-full -translate-y-1/2 bg-gradient-to-l from-[#b62026]/30 to-transparent" />
                    )}
                    {/* Right connector */}
                    {idx !== steps.length - 1 && (
                      <div className="absolute left-1/2 top-1/2 ml-8 h-[2px] w-full -translate-y-1/2 bg-gradient-to-r from-[#b62026]/30 to-transparent" />
                    )}
                    <div
                      className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full ${item.bg} shadow-lg transition-transform duration-300 group-hover:-translate-y-1`}
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#fed54f] text-[10px] font-black text-[#0e2d4c]">
                        {item.step}
                      </span>
                    </div>
                  </div>
                  <h3 className="mb-1.5 text-base font-bold text-[#0e2d4c]">
                    {item.title}
                  </h3>
                  <p className="max-w-[200px] text-sm leading-relaxed text-slate-500">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════
          BOTTOM CTA BANNER
      ═══════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0e2d4c] via-[#14386a] to-[#0e2d4c] p-8 text-center shadow-2xl sm:rounded-3xl sm:p-12">
          {/* Blobs */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#b62026]/15 blur-2xl sm:h-64 sm:w-64" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-[#fed54f]/10 blur-2xl sm:h-48 sm:w-48" />

          <div className="relative">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#fed54f]/70 sm:text-xs">
              พร้อมแล้ว?
            </p>
            <h2 className="mb-2 text-xl font-bold text-white sm:text-3xl">
              ดูคำขอทั้งหมดของคุณ
            </h2>
            <p className="mx-auto mb-7 max-w-sm text-xs leading-relaxed text-white/50 sm:mb-8 sm:text-sm">
              ตรวจสอบและติดตามสถานะคำขอทั้งหมดในที่เดียว
            </p>
            <Link
              href="/my-requests"
              className="group inline-flex w-full max-w-xs items-center justify-center gap-2.5 rounded-xl bg-[#fed54f] px-8 py-3.5 text-sm font-bold text-[#0e2d4c] shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-xl sm:w-auto"
            >
              คำขอของฉันทั้งหมด
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
