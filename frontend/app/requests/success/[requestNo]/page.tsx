import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ requestNo: string }>;
};

export default async function Page({ params }: PageProps) {
  await params;
  redirect("/requests/success");
}
