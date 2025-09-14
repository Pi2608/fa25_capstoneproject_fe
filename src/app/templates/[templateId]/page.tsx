import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  redirect(`/templates/${templateId}/details`);
}
