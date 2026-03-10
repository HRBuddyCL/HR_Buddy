import Link from "next/link";

type RouteItem = {
  path: string;
  label: string;
  phase: string;
};

const routeItems: RouteItem[] = [
  { path: "/", label: "Home", phase: "Phase 2" },
  { path: "/requests/new/building", label: "New Building Request", phase: "Phase 2" },
  { path: "/requests/new/vehicle", label: "New Vehicle Request", phase: "Phase 2" },
  { path: "/requests/new/messenger", label: "New Messenger Request", phase: "Phase 2" },
  { path: "/requests/new/document", label: "New Document Request", phase: "Phase 2" },
  { path: "/requests/success/REQ-0001", label: "Request Success", phase: "Phase 2" },
  { path: "/auth/otp", label: "OTP Gate", phase: "Phase 3" },
  { path: "/my-requests", label: "My Requests", phase: "Phase 3" },
  { path: "/my-requests/1", label: "My Request Detail", phase: "Phase 3" },
  { path: "/messenger/link/sample-token", label: "Messenger Magic Link", phase: "Phase 4" },
  { path: "/admin/login", label: "Admin Login", phase: "Phase 5" },
  { path: "/admin", label: "Admin Dashboard", phase: "Phase 5" },
  { path: "/admin/requests", label: "Admin Requests", phase: "Phase 5" },
  { path: "/admin/requests/1", label: "Admin Request Detail", phase: "Phase 5" },
  { path: "/admin/settings", label: "Admin Settings", phase: "Phase 6" },
  { path: "/admin/audit", label: "Admin Audit", phase: "Phase 6" },
  { path: "/unauthorized", label: "Unauthorized (403)", phase: "Phase 7" },
];

const phaseSteps = [
  "Phase 1: Foundation (layout, shared UI, API client, auth token store)",
  "Phase 2: Employee create request flow (4 forms + success)",
  "Phase 3: OTP and tracking flow (OTP, my requests, detail)",
  "Phase 4: Messenger magic link flow",
  "Phase 5: Admin core flow (login, dashboard, requests, detail)",
  "Phase 6: Admin settings and audit",
  "Phase 7: QA and polish (responsive, accessibility, E2E)",
];

export default function Home() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-100 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">HR-Buddy Frontend Starter</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Route Map and UI Phase Plan</h1>
        <p className="mt-3 text-slate-700">
          This scaffold locks the URL structure first so we can build each phase without changing paths later.
        </p>
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">UI Phase Sequence</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          {phaseSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Route Map (All Pages)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {routeItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-400 hover:bg-white"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.phase}</p>
              <p className="mt-1 font-medium text-slate-900">{item.label}</p>
              <p className="mt-1 text-sm text-slate-600">{item.path}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

