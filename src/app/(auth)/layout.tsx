import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { APP_NAME } from "@/lib/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-safe pb-safe">
      <header className="pt-8 pb-10">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Logo className="size-9" />
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
      </header>
      <main className="flex-1 pb-10">{children}</main>
    </div>
  );
}
