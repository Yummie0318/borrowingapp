"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { useDismiss } from "./useDismiss";

type Mode = "light" | "dark" | "system";
const accents = [
  ["green", "Green", "#145A47"], ["blue", "Blue", "#0066CC"], ["violet", "Violet", "#6C4CC8"],
  ["rose", "Rose", "#C9305C"], ["orange", "Orange", "#C4550A"], ["graphite", "Graphite", "#3C3C43"],
] as const;
const modes: { id: Mode; label: string; icon: "sun" | "moon" | "monitor" }[] = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
  { id: "system", label: "Auto", icon: "monitor" },
];

function apply(mode: Mode, accent: string) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const r = document.documentElement;
  r.dataset.theme = dark ? "dark" : "light";
  r.dataset.accent = accent;
  r.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("system");
  const [accent, setAccent] = useState("green");
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  useEffect(() => {
    try {
      setMode((localStorage.getItem("bd_mode") as Mode) || "system");
      setAccent(localStorage.getItem("bd_accent") || "green");
    } catch {}
  }, []);

  // In Auto mode, follow the device when it switches between light and dark.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const h = () => apply("system", accent);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [mode, accent]);

  function choose(m: Mode, a: string) {
    setMode(m); setAccent(a); apply(m, a);
    try { localStorage.setItem("bd_mode", m); localStorage.setItem("bd_accent", a); } catch {}
  }

  return (
    <div ref={ref} className="relative">
      <Tooltip label="Appearance" disabled={open}>
        <button onClick={() => setOpen(!open)} className="btn-icon" aria-label="Appearance" aria-expanded={open} aria-haspopup="dialog">
          <Icon name="palette" />
        </button>
      </Tooltip>
      {open && (
        <div role="dialog" aria-label="Appearance" className="absolute right-0 top-full z-50 mt-2 w-[min(16rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <p className="mb-2 px-1 text-xs font-medium text-ink/60">Theme</p>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-paper p-1" role="radiogroup" aria-label="Theme">
            {modes.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => choose(m.id, accent)}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                  mode === m.id ? "bg-surface text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                }`}
              >
                <Icon name={m.icon} size={18} />
                {m.label}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-4 px-1 text-xs font-medium text-ink/60">Accent color</p>
          <div className="flex justify-between px-1" role="radiogroup" aria-label="Accent color">
            {accents.map(([id, label, hex]) => (
              <Tooltip key={id} label={label}>
                <button
                  role="radio"
                  aria-checked={accent === id}
                  aria-label={label}
                  onClick={() => choose(mode, id)}
                  style={{ background: hex }}
                  className={`flex h-9 w-9 items-center sm:h-8 sm:w-8 justify-center rounded-full text-white ring-offset-2 ring-offset-surface transition-shadow ${
                    accent === id ? "ring-2 ring-ink/40" : "hover:ring-2 hover:ring-ink/20"
                  }`}
                >
                  {accent === id && <Icon name="check" size={16} />}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
