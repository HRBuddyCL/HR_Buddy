"use client";

import { useEffect } from "react";
import Image from "next/image";

type ImagePreviewModalProps = {
  open: boolean;
  title: string;
  src: string;
  onClose: () => void;
};

export function ImagePreviewModal({ open, title, src, onClose }: ImagePreviewModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-3 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="truncate pr-3 text-sm font-semibold text-slate-800">{title}</p>
          <button
            type="button"
            className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="bg-slate-100 p-2 sm:p-3">
          <div className="relative h-[68vh] max-h-[760px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Image
              src={src}
              alt={title}
              fill
              unoptimized
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
