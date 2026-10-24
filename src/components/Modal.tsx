"use client";

import { useRef } from "react";
import { Icon } from "./Icon";

export function Modal({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="btn ml-auto inline-flex items-center gap-1.5 !px-3 !py-1.5 text-sm"
      >
        <Icon name="plus" size={16} /> {label}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="m-auto w-[calc(100%-1.5rem)] max-w-xl rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="btn-icon">
            <Icon name="close" size={18} />
          </button>
        </div>
        {/* closes after a valid submit; the server action then redirects with a message */}
        <div className="max-h-[75vh] overflow-y-auto p-4" onSubmit={() => setTimeout(() => ref.current?.close(), 0)}>
          {children}
        </div>
      </dialog>
    </>
  );
}