"use client";

import { useRef, useState, useTransition } from "react";
import Icon from "@hackclub/icons";
import { saveStaffSettings } from "@/app/actions";
import { ACCENTS, THEMES, type StaffSettings } from "@/lib/staffSettings";

const THEME_LABEL = { system: "System", dark: "Dark", light: "Light" } as const;

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="hc-setting-row cursor-pointer">
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        <span className="hc-caption block text-sm">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="hc-switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

// The gear in the top bar. Preferences are saved to the signed-in account, so
// they follow you to any browser.
export default function SettingsMenu({ initial }: { initial: StaffSettings }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [saving, startSaving] = useTransition();

  function update(patch: Partial<StaffSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    // Apply right away; the server renders the same attributes on the next load.
    const el = document.documentElement;
    el.dataset.theme = next.theme;
    el.dataset.accent = next.accent;
    el.dataset.density = next.compact ? "compact" : "normal";
    startSaving(async () => {
      try {
        const result = await saveStaffSettings(next);
        setFailed(!result.ok);
      } catch {
        setFailed(true);
      }
    });
  }

  let status = "Saved to your account.";
  if (saving) status = "Saving...";
  else if (failed) status = "Couldn't save that. It will reset when you reload.";

  return (
    <>
      <button
        type="button"
        className="hc-btn hc-btn-ghost hc-btn-sm hc-btn-icon"
        title="Settings"
        aria-label="Settings"
        onClick={() => dialog.current?.showModal()}
      >
        <Icon glyph="settings" size={20} aria-hidden />
      </button>

      <dialog
        ref={dialog}
        className="hc-dialog hc-settings-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="hc-settings-header">
          <h2 className="hc-heading flex items-center gap-2 text-base">
            <Icon glyph="settings" size={22} className="hc-muted" aria-hidden />
            Settings
          </h2>
          <button type="button" className="hc-kbd cursor-pointer border-0" onClick={() => dialog.current?.close()}>
            Esc
          </button>
        </div>

        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-col gap-2">
            <span className="hc-eyebrow">Theme</span>
            <div className="hc-segmented" role="tablist">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  role="tab"
                  aria-selected={settings.theme === theme}
                  className="hc-segmented-item"
                  onClick={() => update({ theme })}
                >
                  {THEME_LABEL[theme]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="hc-eyebrow">Accent color</span>
            <div className="flex gap-2">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  className="hc-swatch"
                  data-accent={accent}
                  aria-pressed={settings.accent === accent}
                  aria-label={accent}
                  title={accent[0].toUpperCase() + accent.slice(1)}
                  onClick={() => update({ accent })}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <Toggle
              label="Compact mode"
              hint="Tighter tables and smaller text, to fit more on screen."
              checked={settings.compact}
              onChange={(compact) => update({ compact })}
            />
            <Toggle
              label="Review sound"
              hint="A short sound after you submit a review."
              checked={settings.sound}
              onChange={(sound) => update({ sound })}
            />
            <Toggle
              label="Confetti"
              hint="Confetti after you submit a review."
              checked={settings.confetti}
              onChange={(confetti) => update({ confetti })}
            />
          </div>

          <p className="hc-save-status" data-tone={failed && !saving ? "danger" : undefined}>
            {status}
          </p>
        </div>
      </dialog>
    </>
  );
}
