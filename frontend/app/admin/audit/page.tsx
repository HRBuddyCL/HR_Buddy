"use client";

import { RouteGuard } from "@/components/guards/route-guard";
import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <PageScaffold
        title="Admin Audit"
        description="Activity log page with filters and CSV export for compliance and traceability."
        phase="Phase 6 - Admin Settings and Audit"
        apiChecklist={[
          "GET /admin/audit/activity-logs",
          "GET /admin/audit/activity-logs/export/csv",
        ]}
      />
    </RouteGuard>
  );
}
