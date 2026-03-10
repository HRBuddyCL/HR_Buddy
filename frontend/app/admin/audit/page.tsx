import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Admin Audit"
      description="Activity log page with filters and CSV export for compliance and traceability."
      phase="Phase 6 - Admin Settings and Audit"
      apiChecklist={[
        "GET /admin/audit/activity-logs",
        "GET /admin/audit/activity-logs/export/csv",
      ]}
    />
  );
}
