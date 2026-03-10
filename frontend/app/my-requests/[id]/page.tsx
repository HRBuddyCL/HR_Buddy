"use client";

import { RouteGuard } from "@/components/guards/route-guard";
import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <RouteGuard tokenType="employee" redirectTo="/auth/otp">
      <PageScaffold
        title="My Request Detail"
        description="Employee detail page with timeline, cancellation, and attachment operations."
        phase="Phase 3 - OTP and Tracking"
        apiChecklist={[
          "GET /requests/:id",
          "PATCH /requests/:id/cancel",
          "POST /requests/:id/attachments/presign",
          "POST /requests/:id/attachments/complete",
          "GET /requests/:id/attachments/:attachmentId/download-url",
        ]}
      />
    </RouteGuard>
  );
}
