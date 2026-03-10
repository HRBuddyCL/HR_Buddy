import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Building Repair Request"
      description="Employee form for reporting building problems by tower, floor, and category."
      phase="Phase 2 - Employee Core"
      apiChecklist={[
        "GET /reference/departments",
        "GET /reference/problem-categories",
        "POST /requests/building",
      ]}
    />
  );
}
