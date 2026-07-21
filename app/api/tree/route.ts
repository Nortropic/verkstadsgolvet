import { NextRequest, NextResponse } from "next/server";
import { getRepoTree } from "@/lib/github-read";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo") ?? "";
  if (!repo) {
    return NextResponse.json({ ok: false, reason: "error", message: "repo saknas." });
  }
  const result = await getRepoTree(repo);
  return NextResponse.json(result);
}
