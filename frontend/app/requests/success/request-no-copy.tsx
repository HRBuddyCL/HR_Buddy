"use client";

import { useEffect, useState } from "react";

type RequestNoCopyProps = {
  requestNo?: string;
};

export function RequestNoCopy({ requestNo }: RequestNoCopyProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const canCopy = Boolean(requestNo && requestNo !== "-");

  const handleCopy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(requestNo!);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <p className="break-all font-mono text-2xl font-bold tracking-wide text-white">
        {requestNo ?? "-"}
      </p>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!canCopy}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="คัดลอกหมายเลขคำขอ"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h6a2 2 0 002-2v-6a2 2 0 00-2-2h-6a2 2 0 00-2 2v6a2 2 0 002 2z"
          />
        </svg>
        {copied ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
    </div>
  );
}
