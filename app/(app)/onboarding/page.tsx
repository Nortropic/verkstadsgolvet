import PageHeader from "@/components/PageHeader";
import OnboardingForm from "@/components/OnboardingForm";

/**
 * Kund-onboarding (halva 2). Fas A: formulär-skal, inga anrop. ONBOARDING_ENABLED
 * styr om det skrivande/AI-steget (Fas B) är påslaget. Stannar alltid vid granskning.
 */
export default function OnboardingPage() {
  const enabled = process.env.ONBOARDING_ENABLED === "true";

  return (
    <>
      <PageHeader
        title="Ny kund"
        sub="Formulär → research → privat kund-repo → STOPP för granskning"
      />
      <div className="panel" style={{ maxWidth: 840 }}>
        <OnboardingForm enabled={enabled} />
      </div>
    </>
  );
}
