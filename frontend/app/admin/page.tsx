import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Admin Dashboard"
      description="Admin dashboard with summaries and SLA risk overview."
      phase="Phase 5 - Admin Core"
      apiChecklist={[
        "GET /admin/requests/report/summary",
        "GET /admin/notifications",
      ]}
    />
  );
}
