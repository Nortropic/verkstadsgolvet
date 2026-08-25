/**
 * Fail-closed konsumtion av det KANONISKA researchkontraktet.
 *
 * Kontraktet ägs av `Nortropic/nortropic-system` och är ALDRIG auktoritativt här.
 * Denna modul binder ihop den HÄRLEDDA bygg-tids-kopian (`generated.ts`) med dess
 * pinn (`pin.json`) och kör den rena vakten i `verify.ts` innan texten får användas.
 *
 * Drift = FAIL-CLOSED. Hellre ett stopp med ärlig orsak än en research-prompt
 * komponerad mot text som ingen granskat.
 *
 * Serverbunden med avsikt: `crypto` finns inte i klienten, och verifieringen ska ske
 * FÖRE något når webbläsaren. Enda produktionskonsumenten är serverkomponenten
 * `app/(app)/onboarding/page.tsx`.
 */

import pin from "./pin.json";
import {
  CONTRACT_CORE_TEXT,
  CONTRACT_CORE_VERSION,
  CONTRACT_PACK_MODULES,
  CONTRACT_SOURCE_COMMIT,
} from "./generated";
import {
  verifyIdentity,
  ResearchContractDriftError,
  type ContractPin,
  type PackModule,
} from "./verify";

/** Kastar `ResearchContractDriftError` om den härledda kopian inte matchar pinnen. */
export function verifyResearchContractIdentity(): void {
  verifyIdentity(
    {
      coreVersion: CONTRACT_CORE_VERSION,
      coreText: CONTRACT_CORE_TEXT,
      modules: CONTRACT_PACK_MODULES,
    },
    pin as ContractPin
  );
}

/** Hämtar den verifierade kontraktskärnan. Kastar vid drift. */
export function getContractCore(): { version: string; text: string; sourceCommit: string } {
  verifyResearchContractIdentity();
  return { version: CONTRACT_CORE_VERSION, text: CONTRACT_CORE_TEXT, sourceCommit: CONTRACT_SOURCE_COMMIT };
}

/**
 * Hämtar en paketmodul — men ENDAST när paketet är BELAGT.
 *
 * `null` betyder core-only, vilket kontraktet uttryckligen definierar som ett GILTIGT
 * läge, aldrig ett fel. En ANTAGEN bransch aktiverar aldrig en modul (hypotesläget).
 */
export function getPackModule(pack: string | null): PackModule | null {
  verifyResearchContractIdentity();
  if (!pack) return null;
  return CONTRACT_PACK_MODULES.find((m) => m.pack === pack) ?? null;
}

export { ResearchContractDriftError, type PackModule };
export { CONTRACT_CORE_VERSION, CONTRACT_SOURCE_COMMIT };
export const CONTRACT_PIN = pin;
