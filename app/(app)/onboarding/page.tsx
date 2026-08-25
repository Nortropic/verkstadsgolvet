import PageHeader from "@/components/PageHeader";
import OnboardingForm from "@/components/OnboardingForm";
import { getContractCore, getPackModule } from "@/lib/research-contract";
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
  try {
    const core = getContractCore();
    // core-only är default: en paketmodul aktiveras först när paketet är BELAGT.
    // Onboardingformuläret belägger inget paket, så hypotesläget gäller (kontraktet).
    const pack = getPackModule(null);
    contract = {
      version: core.version,
      coreText: core.text,
      sourceCommit: core.sourceCommit,
      pack: pack ? { pack: pack.pack, version: pack.version, text: pack.text } : null,
    };
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
          <OnboardingForm enabled={enabled} contract={contract} />
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
