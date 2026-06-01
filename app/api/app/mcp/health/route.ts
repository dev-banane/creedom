import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { isMcpHealthRange, loadMcpHealth } from "@/lib/mcp-health";

export async function GET(request: Request) {
  const auth = await requireApiAuth();
  if (auth instanceof NextResponse) return auth;

  const rangeParam = new URL(request.url).searchParams.get("range") ?? "30d";
  const range = isMcpHealthRange(rangeParam) ? rangeParam : "30d";

  const health = await loadMcpHealth(auth.supabase, auth.user.id, range);
  return NextResponse.json({ health });
}
