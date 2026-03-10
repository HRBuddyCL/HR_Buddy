import { PageScaffold } from "@/app/_components/page-scaffold";

export default function Page() {
  return (
    <PageScaffold
      title="Admin Login"
      description="HR admin login page to create admin session token."
      phase="Phase 5 - Admin Core"
      apiChecklist={[
        "POST /admin/auth/login",
      ]}
    />
  );
}
