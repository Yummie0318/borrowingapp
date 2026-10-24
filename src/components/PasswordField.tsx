"use client";

import { useState } from "react";

export function PasswordField({
  id, name, label, autoComplete,
}: { id: string; name: string; label: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-6">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          className="field pr-16"
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-accent-ink"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}