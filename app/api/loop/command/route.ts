/**
 * V7 · POST /api/loop/command — de fem typade intentionerna, och ingenting mer.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — COMMAND_CLIENT, AUTH_SECURITY (DJUPFÖRSVAR ·
 * CSRF · RATE LIMIT · LOGGNING) och IMPLEMENTATION_SLICES §V7.
 *
 * BINDANDE
 * · auth() anropas HÄR, i handlern, FÖRE varje grind och varje överlämning. 401 utan session.
 * · LOOP_ENABLED gatar hela trädet. 404 när flaggan är av — aldrig en halv kommandoyta.
 * · Same-origin krävs utöver sessionen. Fel origin ger 403. Endast POST med JSON.
 * · Routen UTFÖR ingenting. Den validerar en intention och lämnar den till controllerns kö.
 *   Ingen shell, ingen Git, ingen filredigering, ingen merge, ingen dom, ingen attestation,
 *   ingen promotion, ingen lease- eller brytarberöring, ingen GitHub-credential.
 * · Ingen optimistisk state: svaret bär kommandots öde, aldrig en uppgifts tillstånd.
 * · Ingen loggning. Varken payloadvärden, sessioner eller nycklar lämnar den här filen.
 *
 * VATTENMÄRKET: routen får läsa controllerns publicerade `seq_watermark` genom V4:s LÄSYTA för
 * att kunna avvisa ett föråldrat antagande tidigt. Läsningen sker LAT och först efter auth(),
 * och den kan bara leda till AVSLAG — ett kommando släpps aldrig igenom för att den såg rätt
 * ut, och controllern gör om bedömningen och är sista instans.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isLoopEnabled } from "@/components/loop/flag";
import {
  COMMAND_DISABLED_ENVELOPE,
  COMMAND_HEADERS,
  COMMAND_UNAUTHORIZED_ENVELOPE,
  createCommandGateway,
  handleCommandRequest,
  type CommandGateway,
} from "@/lib/loop/commands";
import { loadSnapshot } from "@/lib/loop/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // DJUPFÖRSVAR — inte en dubblering av middleware, utan det andra lagret planen kräver.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(COMMAND_UNAUTHORIZED_ENVELOPE, {
      status: 401,
      headers: COMMAND_HEADERS,
    });
  }
  // Produktgrind, läses vid REQUEST (force-dynamic) så en avslagen flagga gäller direkt.
  if (!isLoopEnabled()) {
    return NextResponse.json(COMMAND_DISABLED_ENVELOPE, { status: 404, headers: COMMAND_HEADERS });
  }

  // Identiteten kommer UR SESSIONEN. Kroppen kan inte påstå vem som skickade kommandot.
  const issuedBy = (session.user.email ?? session.user.name ?? "").trim() || "operator";

  const result = await handleCommandRequest(request, {
    issued_by: issuedBy,
    gateway: commandGateway(),
  });
  return NextResponse.json(result.body, { status: result.status, headers: COMMAND_HEADERS });
}

/**
 * EN gateway per instans: ledgern och räknaren ska överleva mellan två klick i samma flik.
 * Båda är BEGRÄNSADE och lokala — idempotensens auktoritet är `command_id` som PRIMARY KEY i
 * controllerns kö, och kön är i dag `blockedCommandQueue()` (S13 finns inte).
 *
 * Skapas LAT, och därmed först efter att handlern har gatat sessionen: ingen kodväg i den här
 * filen rör kontrollplanet innan auth() har svarat.
 */
let gateway: CommandGateway | null = null;

function commandGateway(): CommandGateway {
  if (gateway === null) gateway = createCommandGateway({ observedWatermark: readWatermark });
  return gateway;
}

/**
 * Controllerns senast publicerade vattenmärke, om det går att läsa. Otillgänglig eller
 * okonfigurerad transport ger `null` = OKÄNT — aldrig en nolla och aldrig ett antagande.
 */
async function readWatermark(): Promise<number | null> {
  const result = await loadSnapshot({});
  if (!result.ok || result.data.snapshot === null) return null;
  return result.data.snapshot.seq_watermark;
}
