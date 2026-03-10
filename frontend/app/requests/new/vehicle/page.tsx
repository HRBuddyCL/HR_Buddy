import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Vehicle Repair Request"
      description="Employee form for reporting vehicle symptoms and plate information."
      phase="Phase 2 - Employee Core"
      apiChecklist={[
        "GET /reference/departments",
        "GET /reference/vehicle-issue-categories",
        "POST /requests/vehicle",
      ]}
    />
  );
}
