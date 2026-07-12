import { NextResponse } from "next/server";

const STATUS_URL = "https://status.creed.md";

type StatusColor = "green" | "yellow" | "red";

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function colorFromLabel(label: string): StatusColor {
  const normalized = label.toLowerCase();
  if (
    normalized.includes("operational") ||
    normalized.includes("resolved") ||
    normalized.includes("healthy")
  ) {
    return "green";
  }
  if (
    normalized.includes("outage") ||
    normalized.includes("down") ||
    normalized.includes("disruption")
  ) {
    return "red";
  }
  return "yellow";
}

function labelFromHtml(html: string) {
  const statusMatch = html.match(
    /role="status"[\s\S]*?<span[^>]*font-semibold[^>]*>([\s\S]*?)<\/span>/i,
  );
  return statusMatch ? stripTags(statusMatch[1]) : null;
}

// Status is identical for every visitor, so the CDN serves it: one upstream
// fetch per minute globally instead of one per client per poll.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
} as const;

export async function GET() {
  try {
    const response = await fetch(STATUS_URL, { next: { revalidate: 60 } });

    if (!response.ok) {
      return NextResponse.json(
        { label: "Status unavailable", color: "yellow" satisfies StatusColor },
        { status: 200, headers: CACHE_HEADERS },
      );
    }

    const html = await response.text();
    const label = labelFromHtml(html) ?? "Status unavailable";

    return NextResponse.json(
      { label, color: colorFromLabel(label) },
      { headers: CACHE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { label: "Status unavailable", color: "yellow" satisfies StatusColor },
      { headers: CACHE_HEADERS },
    );
  }
}
