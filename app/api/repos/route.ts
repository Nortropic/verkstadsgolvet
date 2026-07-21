import { NextResponse } from "next/server";
import { listSourceRepos } from "@/lib/github-read";

// Node-runtime (Octokit). Middleware gatar denna route — endast inloggade når hit.
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listSourceRepos();
  // Alltid 200 med envelope — klienten renderar graceful-läge från result.ok.
  return NextResponse.json(result);
}
