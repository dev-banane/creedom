"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Star } from "lucide-react";
import { MenuIcon } from "@/components/ui/menu";
import { CreedWordmark } from "@/components/creed/brand";
import { SystemStatusPill } from "@/components/marketing/system-status";
import { useAnimatedIconControls } from "@/components/creed/animated-icon-controls";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import { useLandingAuthState } from "@/components/marketing/use-landing-auth-state";
import { useGitHubStars } from "@/components/marketing/use-github-stars";
import { cn } from "@/lib/utils";

import {
  CONTACT_MAILTO,
  GITHUB_URL,
  INSTAGRAM_URL,
  TWITTER_URL,
} from "@/lib/branding";

const navItems = [
  { label: "Privacy", href: "/privacy" },
  { label: "Pricing", href: "/pricing" },
  { label: "Context", href: "/context" },
] as const;

const lightApostlesImage = "/assets/landing/backgrounds/light-apostles.avif";
const darkApostlesImage = "/assets/landing/backgrounds/dark-apostles.avif";

// Shared style for the right-aligned white text links in the mobile menu and the
// Start dropdown. Keeps the desktop and mobile menus in lockstep.
const MENU_TEXT_LINK =
  "flex h-9 items-center justify-end rounded-md px-3.5 text-[14px] font-medium leading-none text-white transition-colors duration-200 hover:text-white/55";

// Shared hero banner for the inner marketing pages (pricing, docs, privacy,
// terms, stack). Same framed-card treatment as the landing hero, just shorter:
// the artwork sits inside a rounded card with a thin page-bg gutter, cropped
// cleanly by the frame instead of fading into the page.
export function MarketingHeroBanner({
  configured,
  scrolled,
}: {
  configured: boolean;
  scrolled: boolean;
}) {
  return (
    <section className="relative bg-[var(--creed-background)] p-2.5 md:p-3">
      <div className="relative h-[14.5rem] overflow-hidden rounded-[24px] bg-[#e9e5de] dark:bg-[#0e0e0d] md:h-[17.25rem]">
        {/* The image covers a reference box matching the landing hero card
            (same width + height), so the artwork scales identically; the
            banner just windows the top slice of it. */}
        <div className="absolute inset-x-0 top-0 h-[calc(100svh-1.25rem)] md:h-[calc(100svh-1.5rem)]">
          <Image
            src={lightApostlesImage}
            alt=""
            fill
            priority
            // Pre-optimized AVIF: serve the static file directly (cached
            // immutably) instead of re-encoding through /_next/image.
            unoptimized
            sizes="100vw"
            className="object-cover object-center dark:hidden"
          />
          <Image
            src={darkApostlesImage}
            alt=""
            fill
            unoptimized
            sizes="100vw"
            className="hidden object-cover object-center dark:block"
          />
        </div>
        {/* Top wash keeps the white header legible over the art. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,31,60,0.16)_0%,rgba(15,31,60,0.08)_28%,rgba(15,31,60,0.05)_56%,rgba(255,255,255,0)_76%)] dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.32)_0%,rgba(0,0,0,0.18)_28%,rgba(0,0,0,0.08)_56%,rgba(0,0,0,0)_76%)]" />
        <div className="relative z-10 flex flex-col px-6 py-5 md:px-10 md:py-7">
          <MarketingHeader configured={configured} scrolled={scrolled} />
        </div>
      </div>
    </section>
  );
}

export function MarketingHeader({
  configured,
  scrolled,
}: {
  configured: boolean;
  scrolled: boolean;
}) {
  void scrolled;
  const authState = useLandingAuthState(configured);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileEnterArrow = useAnimatedIconControls(80, undefined, 420);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function closeOnScroll() {
      setMobileMenuOpen(false);
    }

    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => window.removeEventListener("scroll", closeOnScroll);
  }, [mobileMenuOpen]);

  return (
    <header className="relative mx-auto flex w-full max-w-[760px] items-center justify-between">
      <div className="flex items-center md:hidden">
        <Link
          href="/home"
          aria-label="Creed home"
          className="shrink-0 transition-opacity duration-200 hover:opacity-60"
          onClick={() => setMobileMenuOpen(false)}
        >
          <CreedWordmark
            className="ml-1.5"
            imageClassName="invert brightness-0"
          />
        </Link>
      </div>

      <Link
        href="/home"
        aria-label="Creed home"
        className="hidden shrink-0 transition-opacity duration-200 hover:opacity-60 md:block"
      >
        <CreedWordmark className="ml-0" imageClassName="invert brightness-0" />
      </Link>

      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
        {navItems.map((item) => (
          <HeaderTextButton key={item.label} href={item.href}>
            {item.label}
          </HeaderTextButton>
        ))}
      </nav>

      <HeaderAuthActions
        authState={authState}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <AnimatePresence initial={false}>
        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-[90] md:hidden">
            {/* Invisible tap-to-close layer. The blur is local to the
                dropdown card below, not full-screen. */}
            <motion.button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Subtle backdrop blur localized to the menu area. Sits
                OUTSIDE the motion.div below because motion's filter
                animation creates a stacking context that nukes
                backdrop-filter on descendants. A radial-mask fades the
                blur to zero at the edges so there's no visible card
                outline - the blur just melts into the surrounding hero. */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute right-0 top-[3.65rem] h-[19rem] w-[12rem] backdrop-blur-[6px]"
              style={{
                WebkitBackdropFilter: "blur(6px)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 70% 70% at 70% 50%, black 35%, transparent 80%)",
                maskImage:
                  "radial-gradient(ellipse 70% 70% at 70% 50%, black 35%, transparent 80%)",
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-4 top-[4.65rem] flex w-[8.25rem] flex-col items-end gap-2 text-white"
            >
              {navItems.map((item, index) => (
                <motion.div
                  key={item.label}
                  className="relative z-10"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  // Close is the open animation in reverse: same x-slide, but
                  // the last item to appear is the first to leave.
                  exit={{
                    opacity: 0,
                    x: 10,
                    transition: {
                      duration: 0.24,
                      delay: (navItems.length - 1 - index) * 0.04 + 0.04,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  }}
                  transition={{
                    duration: 0.24,
                    delay: 0.04 + index * 0.04,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={MENU_TEXT_LINK}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                // Appears last, so it leaves first when closing.
                exit={{
                  opacity: 0,
                  x: 10,
                  transition: {
                    duration: 0.24,
                    delay: 0,
                    ease: [0.16, 1, 0.3, 1],
                  },
                }}
                transition={{
                  duration: 0.24,
                  delay: 0.18,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative z-10 flex flex-col items-end gap-2"
              >
                {authState === "loading" ? null : authState === "signed-in" ? (
                  <Link
                    href="/file"
                    onClick={() => setMobileMenuOpen(false)}
                    onMouseEnter={mobileEnterArrow.start}
                    onMouseLeave={mobileEnterArrow.settle}
                    onPointerDown={(event) => {
                      if (event.pointerType !== "mouse") {
                        mobileEnterArrow.start();
                      }
                    }}
                    className={cn(MENU_TEXT_LINK, "gap-1.5")}
                  >
                    Continue
                    <ArrowRightIcon ref={mobileEnterArrow.iconRef} className="h-3.5 w-3.5" size={14} />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className={MENU_TEXT_LINK}
                    >
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className={MENU_TEXT_LINK}
                    >
                      Sign up
                    </Link>
                  </>
                )}
                {authState !== "loading" ? (
                  <GitHubStarButton
                    onNavigate={() => setMobileMenuOpen(false)}
                    className="mt-1"
                  />
                ) : null}
              </motion.div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

// `useLandingAuthState` now lives in components/marketing/use-landing-auth-state.ts
// so both the chrome and the pricing card share the same auth listener
// rather than each spinning up their own.

// GitHub octocat mark (same icon as the footer), sized for the star pill.
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function formatStarCount(stars: number | null): string {
  if (stars === null) return "";
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(stars >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }
  return String(stars);
}

// White GitHub "star" pill: octocat mark + a star outline + the live repo star
// count, linking out to the repo. Replaces the old "Get Started" pill in the
// chrome (desktop) and also appears in the mobile menu.
function GitHubStarButton({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const stars = useGitHubStars();
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Star Creed on GitHub"
      onClick={onNavigate}
      className={cn(
        "inline-flex h-9 items-center gap-2.5 rounded-md bg-white px-3 text-[14px] font-medium text-[#19345f] shadow-none transition-colors hover:bg-[#f6f7fb]",
        className,
      )}
    >
      <GitHubMark className="h-[18px] w-[18px]" />
      <span className="inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5" strokeWidth={1.8} />
        {stars !== null ? (
          <span className="tabular-nums">{formatStarCount(stars)}</span>
        ) : null}
      </span>
    </a>
  );
}

// "Start" dropdown for the signed-out desktop chrome: a text trigger that opens
// Login / Sign up in the same blurred, text-button style as the mobile nav.
// Closes on outside click or scroll.
function StartDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onScroll() {
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  const items = [
    { label: "Login", href: "/login" },
    { label: "Sign up", href: "/signup" },
  ];

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-1 rounded-md px-3.5 text-[14px] font-medium text-white transition-colors duration-200 hover:text-white/55"
      >
        Start
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <>
            {/* Localized blur behind the menu (sibling of the menu, not a child:
                motion's filter animation creates a stacking context that would
                nuke a child's backdrop-filter). A radial mask melts it in. */}
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute right-0 top-[2.6rem] h-[7.5rem] w-[11rem] backdrop-blur-[6px]"
              style={{
                WebkitBackdropFilter: "blur(6px)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 70% 70% at 72% 45%, black 35%, transparent 80%)",
                maskImage:
                  "radial-gradient(ellipse 70% 70% at 72% 45%, black 35%, transparent 80%)",
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-[2.6rem] z-10 flex w-[8.5rem] flex-col items-end gap-2 text-white"
            >
              {items.map((item, index) => (
                <motion.div
                  key={item.label}
                  className="w-full"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{
                    opacity: 0,
                    x: 10,
                    transition: {
                      duration: 0.2,
                      delay: (items.length - 1 - index) * 0.04,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  }}
                  transition={{
                    duration: 0.24,
                    delay: 0.04 + index * 0.04,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={MENU_TEXT_LINK}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function HeaderAuthActions({
  authState,
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  authState: "loading" | "signed-in" | "signed-out";
  mobileMenuOpen: boolean;
  setMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const enterArrow = useAnimatedIconControls(80, undefined, 420);

  // Mobile-menu trigger is shared across all states so the navigation links
  // remain reachable. No hover effect (mobile): the icon morphs hamburger <->
  // X as the menu opens and closes, tracking `mobileMenuOpen` through every
  // close path. A plain button (not the shadcn Button) so nothing overrides
  // the icon size or its white colour.
  const mobileLinksTrigger = (
    <button
      type="button"
      onClick={() => setMobileMenuOpen((value) => !value)}
      className="inline-flex size-9 items-center justify-center rounded-md text-white outline-none focus-visible:ring-2 focus-visible:ring-white/20 md:hidden"
      aria-label={
        mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
      }
      aria-expanded={mobileMenuOpen}
    >
      <MenuIcon open={mobileMenuOpen} size={24} />
    </button>
  );

  if (authState === "loading") {
    return <div className="h-9 w-[120px] md:w-[184px]" aria-hidden="true" />;
  }

  // Signed in → "Open" text link into the app (the /file gate routes
  // unpaid / mid-onboarding users on from there) + the GitHub star pill.
  if (authState === "signed-in") {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/file"
          className="hidden h-9 items-center gap-1.5 rounded-md px-3.5 text-[14px] font-medium text-white transition-colors duration-200 hover:text-white/55 md:inline-flex"
          onMouseEnter={enterArrow.start}
          onMouseLeave={enterArrow.settle}
        >
          Continue
          <ArrowRightIcon
            ref={enterArrow.iconRef}
            className="h-3.5 w-3.5"
            size={14}
          />
        </Link>
        <GitHubStarButton className="hidden md:inline-flex" />
        {mobileLinksTrigger}
      </div>
    );
  }

  // Signed out → "Start" dropdown (Login / Sign up) + the GitHub star pill.
  // No "Get Started" pill in the chrome anymore; that lives on the landing
  // page itself.
  return (
    <div className="flex items-center gap-2">
      <StartDropdown />
      <GitHubStarButton className="hidden md:inline-flex" />
      {mobileLinksTrigger}
    </div>
  );
}

function HeaderTextButton({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center rounded-md px-3.5 text-[14px] font-medium text-white transition-colors duration-200 hover:text-white/55",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--creed-border)] px-6 pt-12 md:px-10 md:pt-16 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Link
            href="/home"
            aria-label="Creed home"
            className="inline-block transition-opacity hover:opacity-80"
          >
            <CreedWordmark />
          </Link>
          <p className="t-body-lg mt-4 max-w-sm text-[var(--creed-text-secondary)]">
            Personal context for your agents.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <FooterColumn title="Product" links={["Pricing"]} />
          <FooterColumn title="Legal" links={["Privacy", "Terms", "Stack"]} />
          <FooterColumn
            title="Resources"
            links={["Docs", "Context", "Contact"]}
          />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-7xl">
        <SystemStatusPill />
      </div>

      <div className="mx-auto mt-6 flex max-w-7xl flex-col gap-4 border-t border-[var(--creed-border)] py-6 md:flex-row md:items-center md:justify-between">
        <div className="t-meta text-[var(--creed-text-tertiary)]">
          © 2026 Creed
        </div>
        {/* Social icons: left-to-right order is GitHub → Instagram → X.
            Default colour is the tertiary text grey (inherited from the
            wrapping div); hover fills with the brand blue. */}
        <div className="flex items-center gap-4 text-[var(--creed-text-tertiary)]">
          {GITHUB_URL ? (
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="transition-colors hover:text-[#2563EB]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-[19px] w-[19px]"
              >
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
          ) : null}
          {INSTAGRAM_URL ? (
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="transition-colors hover:text-[#2563EB]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-[20px] w-[20px]"
              >
                <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle
                  cx="17.5"
                  cy="6.5"
                  r="1.1"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </a>
          ) : null}
          {TWITTER_URL ? (
            <a
              href={TWITTER_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="X"
              className="transition-colors hover:text-[#2563EB]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="h-[18px] w-[18px]"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <div className="t-body-lg font-medium text-[var(--creed-text-primary)]">
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {links.map((link) => (
          <Link
            key={link}
            href={
              link === "Pricing"
                ? "/pricing"
                : link === "Privacy"
                  ? "/privacy"
                  : link === "Terms"
                    ? "/terms"
                    : link === "Stack"
                      ? "/stack"
                      : link === "Docs"
                        ? "/docs"
                        : link === "Context"
                          ? "/context"
                          : link === "Contact"
                            ? CONTACT_MAILTO
                            : "#"
            }
            className="t-body-lg block text-[var(--creed-text-secondary)] hover:text-[#2563EB]"
          >
            {link}
          </Link>
        ))}
      </div>
    </div>
  );
}
