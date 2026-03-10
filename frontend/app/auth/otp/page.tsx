import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="OTP Gate"
      description="Employee OTP send/verify page before entering My Requests."
      phase="Phase 3 - OTP and Tracking"
      apiChecklist={[
        "POST /auth-otp/send",
        "POST /auth-otp/verify",
      ]}
    />
  );
}
