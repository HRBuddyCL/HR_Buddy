import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Messenger Magic Link"
      description="Messenger mobile page for status updates, pickup event, and problem reports."
      phase="Phase 4 - Messenger"
      apiChecklist={[
        "GET /messenger/link",
        "PATCH /messenger/link/status",
        "POST /messenger/link/pickup-event",
        "POST /messenger/link/report-problem",
      ]}
    />
  );
}
