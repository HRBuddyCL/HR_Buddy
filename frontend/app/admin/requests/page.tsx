import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Admin Requests Table"
      description="Admin list view with filter/search/date range/export."
      phase="Phase 5 - Admin Core"
      apiChecklist={[
        "GET /admin/requests",
        "GET /admin/requests/export/csv",
      ]}
    />
  );
}
