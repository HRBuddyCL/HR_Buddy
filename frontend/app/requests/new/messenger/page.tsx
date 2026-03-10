import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Messenger Booking Request"
      description="Employee form for creating messenger jobs with sender/receiver and geo fields."
      phase="Phase 2 - Employee Core"
      apiChecklist={[
        "GET /reference/departments",
        "GET /geo/provinces",
        "GET /geo/districts",
        "GET /geo/subdistricts",
        "GET /geo/postal-code",
        "POST /requests/messenger",
      ]}
    />
  );
}
