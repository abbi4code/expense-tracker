import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupScreen } from "@/components/groups/group-screen";

export const metadata: Metadata = { title: "Group" };

export default async function GroupPage({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <GroupScreen groupId={id} />
    </Suspense>
  );
}
