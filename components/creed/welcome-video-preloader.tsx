"use client";

// Warms the browser cache with the welcome pop-up's slide videos so the tour
// never lands on a slide whose clip hasn't loaded. Rendered ahead of the pop-up
// (during onboarding, and again on app entry when the tour will show), it mounts
// hidden <video preload="auto"> elements that mirror the pop-up's own <video>
// (same URLs + source order), so those requests are served straight from cache.
//
// Keys mirror the SLIDES in welcome-dialog.tsx. Files live in
// /public/assets/popups/<variant>/<key>.mp4 (+ optional .webm). The company
// variant adds the members slide and pulls from the company folder.

import {
  WELCOME_MEDIA_VERSION,
  type WelcomeVariant,
} from "@/lib/welcome-preview";

const PERSONAL_KEYS = ["file", "connect", "analysis", "panel", "tab", "discord"];
const COMPANY_KEYS = ["file", "members", "connect", "analysis", "panel", "tab", "discord"];

export function WelcomeVideoPreloader({
  variant = "personal",
}: {
  variant?: WelcomeVariant;
}) {
  const keys = variant === "company" ? COMPANY_KEYS : PERSONAL_KEYS;
  const base = `/assets/popups/${variant}`;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed h-0 w-0 overflow-hidden opacity-0"
    >
      {keys.map((key) => (
        <video key={key} muted playsInline preload="auto" tabIndex={-1}>
          <source src={`${base}/${key}.webm?v=${WELCOME_MEDIA_VERSION}`} type="video/webm" />
          <source src={`${base}/${key}.mp4?v=${WELCOME_MEDIA_VERSION}`} type="video/mp4" />
        </video>
      ))}
    </div>
  );
}
