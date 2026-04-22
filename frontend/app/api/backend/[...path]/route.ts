import { NextRequest } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/auth/admin-session";
import { EMPLOYEE_SESSION_COOKIE } from "@/lib/auth/employee-session";

const RAW_UPSTREAM_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

const UPSTREAM_BASE_URL = RAW_UPSTREAM_BASE_URL.replace(/\/$/, "");
const RETRYABLE_STATUS = new Set([502, 503, 504]);

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildUpstreamUrl(request: NextRequest, pathSegments: string[]) {
  const joinedPath = pathSegments.join("/");
  const upstreamUrl = new URL(`${UPSTREAM_BASE_URL}/${joinedPath}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  return upstreamUrl;
}

function buildUpstreamHeaders(request: NextRequest, pathSegments: string[]) {
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-forwarded-host", request.headers.get("host") ?? "");

  if (!headers.has("authorization")) {
    const isAdminPath = pathSegments[0] === "admin";
    const sessionToken = isAdminPath
      ? getAdminSessionFromRequest(request).token
      : (request.cookies.get(EMPLOYEE_SESSION_COOKIE)?.value ?? null);

    if (sessionToken) {
      headers.set("authorization", `Bearer ${sessionToken}`);
    }
  }

  headers.delete("cookie");

  return headers;
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const upstreamUrl = buildUpstreamUrl(request, path);
  const method = request.method.toUpperCase();
  const isRetryableMethod =
    method === "GET" || method === "HEAD" || method === "OPTIONS";
  const maxAttempts = isRetryableMethod ? 3 : 1;

  const headers = buildUpstreamHeaders(request, path);
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
      });

      const shouldRetry =
        attempt < maxAttempts - 1 &&
        RETRYABLE_STATUS.has(upstreamResponse.status);

      if (shouldRetry) {
        await sleep(700 * (attempt + 1));
        continue;
      }

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: upstreamResponse.headers,
      });
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        await sleep(700 * (attempt + 1));
        continue;
      }

      return Response.json(
        {
          message: "Upstream backend is temporarily unavailable",
          error: error instanceof Error ? error.message : "Unknown proxy error",
        },
        { status: 503 },
      );
    }
  }

  return Response.json(
    {
      message: "Upstream backend is temporarily unavailable",
    },
    { status: 503 },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}
