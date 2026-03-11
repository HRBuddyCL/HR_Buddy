import type { NextConfig } from "next";

function resolveApiOrigin() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    return null;
  }

  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return null;
  }
}

function resolveExtraConnectSources() {
  const raw = process.env.FRONTEND_CSP_CONNECT_SRC ?? "";

  return raw
    .split(",")
    .map((source) => source.trim())
    .filter((source) => source.length > 0);
}

function buildContentSecurityPolicy() {
  const connectSrc = new Set<string>(["'self'"]);

  const apiOrigin = resolveApiOrigin();
  if (apiOrigin) {
    connectSrc.add(apiOrigin);
  }

  for (const source of resolveExtraConnectSources()) {
    connectSrc.add(source);
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    connectSrc.add("ws:");
    connectSrc.add("wss:");
  }

  // Next.js App Router injects inline runtime/hydration scripts.
  // Without nonce/hash plumbing, blocking inline scripts will break page boot.
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    `connect-src ${Array.from(connectSrc).join(" ")}`,
  ];

  if (isProduction) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site",
  },
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
