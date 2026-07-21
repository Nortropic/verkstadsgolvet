import TopBar from "@/components/TopBar";
import OnboardingForm from "@/components/OnboardingForm";

/**
 * Kund-onboarding (halva 2). Middleware skyddar routen (inloggad = når hit).
 * Fas A: formulär-skal, inga anrop. ONBOARDING_ENABLED styr om det skrivande/AI-steget
 * (Fas B) är påslaget. Flödet stannar ALLTID vid research-granskning — startar aldrig bygge.
 */
export default function OnboardingPage() {
  const enabled = process.env.ONBOARDING_ENABLED === "true";

  return (
    <>
      <TopBar status="onboarding · halv-auto" />
      <div className="panel" style={{ maxWidth: 840, margin: "0 auto" }}>
        <h2>
          <span className="idx">◆</span> Ny kund · onboarding{" "}
          <span className="hint">— formulär → research → privat kund-repo → STOPP</span>
        </h2>
        <OnboardingForm enabled={enabled} />
      </div>
    </>
  );
}
