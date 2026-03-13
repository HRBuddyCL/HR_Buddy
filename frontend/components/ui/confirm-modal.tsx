"use client";

import React from "react";

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900">
          {title ?? "ยืนยัน"}
        </h3>
        {description ? (
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-md bg-[#0e2d4c] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a4a7a]"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
