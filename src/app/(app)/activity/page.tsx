import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityScreen } from "@/components/activity/activity-screen";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <Suspense>
      <ActivityScreen />
    </Suspense>
  );
}
