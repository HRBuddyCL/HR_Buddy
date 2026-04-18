import { useEffect } from "react";

type ErrorToastProps = {
  message: string | null;
  onClose: () => void;
  title?: string;
  durationMs?: number;
  variant?: "default" | "large";
};

export function ErrorToast({
  message,
  onClose,
  title = "เกิดข้อผิดพลาด",
  durationMs = 4500,
  variant = "default",
}: ErrorToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, onClose, durationMs]);

  if (!message) {
    return null;
  }

  const isLarge = variant === "large";

  return (
    <div className="pointer-events-none fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-50 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-6">
      <div
        role="alert"
        aria-live="assertive"
        className={`pointer-events-auto flex items-start border border-[#b62026]/25 bg-white shadow-2xl ${
          isLarge
            ? "w-[min(95vw,34rem)] gap-4 rounded-2xl px-5 py-4"
            : "w-[min(92vw,26rem)] gap-3 rounded-xl px-4 py-3.5"
        }`}
      >
        <div
          className={`mt-0.5 rounded-full bg-red-50 text-[#b62026] ${
            isLarge ? "p-1.5" : "p-1"
          }`}
        >
          <svg
            className={isLarge ? "h-5 w-5" : "h-4 w-4"}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`font-bold text-[#b62026] ${
              isLarge ? "text-base" : "text-sm"
            }`}
          >
            {title}
          </p>
          <p
            className={`mt-0.5 break-words text-slate-700 ${
              isLarge ? "text-sm leading-relaxed" : "text-xs"
            }`}
          >
            {message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 ${
            isLarge ? "rounded-lg p-1.5" : "rounded-md p-1"
          }`}
          aria-label="ปิดการแจ้งเตือน"
        >
          <svg
            className={isLarge ? "h-5 w-5" : "h-4 w-4"}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
