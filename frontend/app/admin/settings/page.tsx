"use client";

import { RouteGuard } from "@/components/guards/route-guard";
import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <PageScaffold
        title="Admin Settings"
        description="Master data setup for departments, categories, operators, and SLA-related defaults."
        phase="Phase 6 - Admin Settings and Audit"
        apiChecklist={[
          "GET /admin/settings/departments",
          "POST /admin/settings/departments",
          "PATCH /admin/settings/departments/:id",
          "GET /admin/settings/problem-categories",
          "POST /admin/settings/problem-categories",
          "PATCH /admin/settings/problem-categories/:id",
          "GET /admin/settings/vehicle-issue-categories",
          "POST /admin/settings/vehicle-issue-categories",
          "PATCH /admin/settings/vehicle-issue-categories/:id",
          "GET /admin/settings/operators",
          "POST /admin/settings/operators",
          "PATCH /admin/settings/operators/:id",
        ]}
      />
    </RouteGuard>
  );
}
