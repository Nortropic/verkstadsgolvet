import { NextRequest, NextResponse } from "next/server";
import { getFileContent } from "@/lib/github-read";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo") ?? "";
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!repo || !path) {
    return NextResponse.json({ ok: false, reason: "error", message: "repo/path saknas." });
  }
  const result = await getFileContent(repo, path);
  return NextResponse.json(result);
}
