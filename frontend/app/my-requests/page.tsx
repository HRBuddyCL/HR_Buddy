"use client";

import { RouteGuard } from "@/components/guards/route-guard";
import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <RouteGuard tokenType="employee" redirectTo="/auth/otp">
      <PageScaffold
        title="My Requests"
        description="Employee list page with tab, search, and filtering for own requests."
        phase="Phase 3 - OTP and Tracking"
        apiChecklist={[
          "GET /requests/my",
          "GET /notifications/my",
          "PATCH /notifications/my/read-all",
        ]}
      />
    </RouteGuard>
  );
}
