import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupScreen } from "@/components/groups/group-screen";

export const metadata: Metadata = { title: "Group" };

// No data is fetched on the server: render each group's shell once, then serve it from cache.
export function generateStaticParams() {
  return [];
}

export default async function GroupPage({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <GroupScreen groupId={id} />
    </Suspense>
  );
}
