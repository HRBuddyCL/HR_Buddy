import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Admin Request Detail"
      description="Admin detail with status action, operator selection, and attachment upload."
      phase="Phase 5 - Admin Core"
      apiChecklist={[
        "GET /admin/requests/:id",
        "PATCH /admin/requests/:id/status",
        "POST /admin/requests/:id/attachments/presign",
        "POST /admin/requests/:id/attachments/complete",
        "GET /admin/requests/:id/attachments/:attachmentId/download-url",
      ]}
    />
  );
}
