"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icon";

export function ModalButton({
  label, title, subtitle, triggerClassName = "btn-quiet", children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [ready, setReady] = useState(false);

  function openIt() {
    setReady(true);
    ref.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={openIt} className={triggerClassName}>{label}</button>
      <dialog
        ref={ref}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-left text-sm text-ink shadow-xl backdrop:bg-black/40"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-ink/60">{subtitle}</p>}
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="btn-icon">
            <Icon name="close" size={18} />
          </button>
        </div>
        {/* closes after a valid submit; the server action then redirects with a message */}
        <div className="max-h-[75vh] overflow-y-auto p-4" onSubmit={() => setTimeout(() => ref.current?.close(), 0)}>
          {ready && children}
        </div>
      </dialog>
    </>
  );
}