"use client";

import { type ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthToken, type TokenType } from "@/lib/auth/tokens";

type RouteGuardProps = {
  tokenType: TokenType;
  redirectTo: string;
  children: ReactNode;
};

export function RouteGuard({ tokenType, redirectTo, children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const hasToken = Boolean(getAuthToken(tokenType));

  useEffect(() => {
    if (!hasToken) {
      router.replace(`${redirectTo}?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [hasToken, pathname, redirectTo, router]);

  if (!hasToken) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">Checking session...</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
