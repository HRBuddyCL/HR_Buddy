import { NextRequest, NextResponse } from "next/server";
import { hasActiveEmployeeSessionFromRequest } from "@/lib/auth/employee-session";

function resolveSafeNextPath(nextRaw: string | null) {
  if (!nextRaw || !nextRaw.startsWith("/")) {
    return null;
  }

  if (nextRaw.startsWith("//")) {
    return null;
  }

  return nextRaw;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasActiveSession = hasActiveEmployeeSessionFromRequest(request);

  if (pathname === "/auth/otp") {
    if (hasActiveSession) {
      const nextParam = resolveSafeNextPath(
        request.nextUrl.searchParams.get("next"),
      );
      const target = nextParam ?? "/my-requests";
      return NextResponse.redirect(new URL(target, request.url));
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/my-requests")) {
    if (!hasActiveSession) {
      const loginUrl = new URL("/auth/otp", request.url);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/otp", "/my-requests/:path*"],
};
