import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
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
  );
}
