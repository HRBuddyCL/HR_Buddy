#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const port = Number(process.env.FRONTEND_SMOKE_PORT ?? 3105);
const host = process.env.FRONTEND_SMOKE_HOST ?? "127.0.0.1";
const fallbackBaseUrl = process.env.FRONTEND_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const baseUrl = process.argv.includes("--self-host") ? `http://${host}:${port}` : fallbackBaseUrl.replace(/\/$/, "");

const routes = [
  "/",
  "/requests/new/building",
  "/requests/new/vehicle",
  "/requests/new/messenger",
  "/requests/new/document",
  "/requests/success/REQ-SMOKE-0001",
  "/auth/otp",
  "/my-requests",
  "/my-requests/sample-id",
  "/messenger/link/sample-token",
  "/admin/login",
  "/admin",
  "/admin/requests",
  "/admin/requests/sample-id",
  "/admin/settings",
  "/admin/audit",
];

const selfHost = process.argv.includes("--self-host");
const requireApi = process.argv.includes("--require-api") || String(process.env.SMOKE_REQUIRE_API ?? "false").toLowerCase() === "true";
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

function log(message) {
  process.stdout.write(`${message}\n`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(3000),
      });

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await wait(600);
  }

  const message = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`Frontend server did not become ready within ${timeoutMs}ms (${message})`);
}

async function checkRoute(route) {
  const response = await fetch(`${baseUrl}${route}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });

  if (response.status < 200 || response.status >= 400) {
    throw new Error(`${route} returned ${response.status}`);
  }

  const html = await response.text();
  if (!html.includes("<html")) {
    throw new Error(`${route} did not return an HTML document`);
  }

  log(`[smoke] ok ${route} (${response.status})`);
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      signal: AbortSignal.timeout(7000),
      redirect: "manual",
    });

    if (response.status !== 200) {
      throw new Error(`/health returned ${response.status}`);
    }

    log(`[smoke] ok API health ${apiBaseUrl}/health`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    if (requireApi) {
      throw new Error(`API health check failed: ${message}`);
    }

    log(`[smoke] warn API health check skipped/fail: ${message}`);
  }
}

async function runChecks() {
  for (const route of routes) {
    await checkRoute(route);
  }

  await checkApiHealth();
  log(`[smoke] success: checked ${routes.length} frontend routes at ${baseUrl}`);
}

async function withSelfHostedServer(work) {
  const devCommand = `npm run dev -- --hostname ${host} --port ${port}`;
  log(`[smoke] starting frontend dev server at ${baseUrl}`);

  const child = spawn(devCommand, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  let exited = false;
  let spawnError = null;

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[dev] ${chunk.toString()}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[dev] ${chunk.toString()}`);
  });

  child.on("error", (error) => {
    spawnError = error;
  });

  child.on("exit", () => {
    exited = true;
  });

  const cleanup = () => {
    if (!exited) {
      child.kill("SIGTERM");
    }
  };

  try {
    await wait(300);

    if (spawnError) {
      throw spawnError;
    }

    await waitForServer(`${baseUrl}/`);
    await work();
  } finally {
    cleanup();
    await wait(500);
  }
}

async function main() {
  if (selfHost) {
    await withSelfHostedServer(runChecks);
    return;
  }

  log(`[smoke] checking existing frontend at ${baseUrl}`);
  await runChecks();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[smoke] failed: ${message}\n`);

  if (!selfHost) {
    process.stderr.write("[smoke] tip: start frontend first, or run `npm run smoke:self-host`\n");
  }

  process.exit(1);
});
