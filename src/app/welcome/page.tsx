import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { WelcomeForm } from "@/components/onboarding/welcome-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.onboarded_at) redirect("/home");

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-6 pt-safe pb-safe">
      <header className="pt-8 pb-8">
        <Logo className="size-9" />
      </header>
      <main className="pb-10">
        <WelcomeForm userId={userId} firstName={profile?.display_name?.split(" ")[0]} />
      </main>
    </div>
  );
}
