import PageHeader from "@/components/PageHeader";
import OnboardingForm from "@/components/OnboardingForm";
import { getContractCore, getPackModule, CONTRACT_PIN } from "@/lib/research-contract";
import type { VerifiedContract } from "@/lib/prompt-research";

/**
 * Kund-onboarding (halva 2). Fas A: formulär-skal, inga anrop. ONBOARDING_ENABLED
 * styr om det skrivande/AI-steget (Fas B) är påslaget. Stannar alltid vid granskning.
 *
 * S1 (Webbförvaltningen): denna serverkomponent är FAIL-CLOSED-grinden för det
 * kanoniska researchkontraktet. Kontraktets identitet verifieras HÄR; drift ger en
 * ärlig felyta i stället för en research-prompt. Klienten komponerar aldrig utan en
 * verifierad kontraktstext.
 */
export default function OnboardingPage() {
  const enabled = process.env.ONBOARDING_ENABLED === "true";

  let contract: VerifiedContract | null = null;
  let contractError: string | null = null;
  let tillgangligaPaket: { pack: string; version: string; text: string }[] = [];
  try {
    const core = getContractCore();
    // core-only är DEFAULT: en paketmodul aktiveras först när paketet är BELAGT.
    // S2: pakethypotesen är OPERATÖRSVÄND och överstyrbar — operatören kan bekräfta
    // att paketet är belagt, men ingenting gissar åt den. Alla tillgängliga moduler
    // skickas därför VERIFIERADE från servern; klienten väljer, men kan aldrig
    // uppfinna en modul som inte passerat identitetskontrollen.
    const packs = CONTRACT_PIN.paketmoduler
      .map((p) => getPackModule(p.pack))
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .map((m) => ({ pack: m.pack, version: m.version, text: m.text }));
    contract = {
      version: core.version,
      coreText: core.text,
      sourceCommit: core.sourceCommit,
      pack: null,
    };
    tillgangligaPaket = packs;
  } catch (e) {
    contractError = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <PageHeader
        title="Ny kund"
        sub="Formulär → research → privat kund-repo → STOPP för granskning"
      />
      <div className="panel" style={{ maxWidth: 840 }}>
        {contract ? (
          <OnboardingForm enabled={enabled} contract={contract} tillgangligaPaket={tillgangligaPaket} />
        ) : (
          <div role="alert">
            <h2>Researchkontraktet kunde inte verifieras</h2>
            <p>
              Ingen research-prompt komponeras. Kontraktet är kanoniskt i{" "}
              <code>Nortropic/nortropic-system</code> och måste matcha den pinnade
              identiteten exakt — hellre stopp än en prompt byggd på text som ingen
              granskat.
            </p>
            <p>
              <strong>Orsak:</strong> {contractError}
            </p>
            <p>
              Åtgärd: kör <code>node scripts/sync-research-contract.mjs --system-root
              &lt;path-till-nortropic-system&gt;</code> mot en granskad commit.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
