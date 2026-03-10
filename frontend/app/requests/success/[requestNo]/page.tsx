import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Request Success"
      description="Confirmation page after submit that shows request number and next actions."
      phase="Phase 2 - Employee Core"
      apiChecklist={[
        "No API call in UI shell",
        "Uses request number from route param",
      ]}
    />
  );
}
