"use client";

// Shared split-screen chrome for the auth surface: the branded left column
// (wordmark, optional top-right link, centred content, footer) and the framed
// image panel on the right. /login, /signup and /reset-password all render
// inside it so they stay visually identical.

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CreedWordmark } from "@/components/creed/brand";
import { CONTACT_MAILTO } from "@/lib/branding";

const lightPanelImage = "/assets/landing/backgrounds/surmon-light.avif";
const darkPanelImage = "/assets/landing/backgrounds/surmon-dark.avif";

export function AuthShell({ topRight, children }: { topRight?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen bg-[var(--creed-background)] text-[var(--creed-text-primary)]">
      <div className="flex w-full flex-col px-6 py-6 md:w-1/2 md:px-12 md:py-8 lg:px-20">
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            aria-label="Creed home"
            className="-ml-2 inline-flex items-center rounded-[10px] px-2 py-1.5 transition-colors duration-150 hover:bg-[var(--creed-surface-raised)]"
          >
            <CreedWordmark className="ml-0" />
          </Link>
          {topRight ? <div>{topRight}</div> : null}
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>

        <div className="flex items-center justify-between text-[13px] text-[var(--creed-text-tertiary)]">
          <span>© 2026 Creed</span>
          <div className="flex items-center gap-5">
            <a href={CONTACT_MAILTO} className="transition-colors hover:text-[#2563EB]">
              Contact
            </a>
            <Link href="/docs" className="transition-colors hover:text-[#2563EB]">
              Docs
            </Link>
          </div>
        </div>
      </div>

      {/* Image panel (hidden on mobile), framed by a rounded card with a thin
          gutter to match the landing hero. */}
      <div className="hidden w-1/2 p-3 md:flex">
        <div className="relative flex-1 overflow-hidden rounded-[28px] bg-[#e9e5de] dark:bg-[#0e0e0d]">
          <Image
            src={lightPanelImage}
            alt=""
            fill
            priority
            // Pre-optimized AVIF: serve the static file directly (cached
            // immutably) instead of re-encoding through /_next/image.
            unoptimized
            sizes="50vw"
            className="object-cover object-center dark:hidden"
          />
          <Image
            src={darkPanelImage}
            alt=""
            fill
            unoptimized
            sizes="50vw"
            className="hidden object-cover object-center dark:block"
          />
        </div>
      </div>
    </div>
  );
}
