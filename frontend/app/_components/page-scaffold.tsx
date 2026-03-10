import Link from "next/link";

type PageScaffoldProps = {
  title: string;
  description: string;
  phase: string;
  apiChecklist: string[];
  backHref?: string;
  backLabel?: string;
};

export function PageScaffold({
  title,
  description,
  phase,
  apiChecklist,
  backHref = "/",
  backLabel = "Back to Route Map",
}: PageScaffoldProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">{phase}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-slate-700">{description}</p>
        <Link
          href={backHref}
          className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          {backLabel}
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">API Checklist</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {apiChecklist.map((item) => (
            <li key={item} className="rounded-md bg-slate-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
