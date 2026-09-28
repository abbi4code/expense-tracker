import type { Metadata } from "next";
import { Logo } from "@/components/app/logo";
import { JoinScreen } from "@/components/groups/join-screen";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join group" };

// Signed-out visitors are sent to /login?next=/join/<code> by the proxy and come back here.
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data?.claims.sub ?? "")
    .maybeSingle();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-6 pt-safe pb-safe">
      <header className="pt-8 pb-8">
        <Logo className="size-9" />
      </header>
      <main className="pb-10">
        <JoinScreen code={code} defaultName={profile?.display_name ?? ""} />
      </main>
    </div>
  );
}
