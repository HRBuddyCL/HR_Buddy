import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Document Request"
      description="Employee form for requesting official documents with delivery method."
      phase="Phase 2 - Employee Core"
      apiChecklist={[
        "GET /reference/departments",
        "POST /requests/document",
      ]}
    />
  );
}
