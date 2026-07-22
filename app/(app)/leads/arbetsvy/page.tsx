import PageHeader from "@/components/PageHeader";

/** Scaffold — Fas 5 fyller detta med kanban + SMS-mallgenerering. */
export default function LeadsArbetsvyPage() {
  return (
    <>
      <PageHeader
        title="Arbetsvy"
        sub="Flödet: kvalificerad → demo byggd → kontaktad → svar → möte"
      />
      <div className="panel" style={{ maxWidth: 720 }}>
        <h2>
          <span className="idx">◆</span> Byggs — Fas 5
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 10, lineHeight: 1.65 }}>
          Kanban-liknande statusflöde. Per lead: demo_url, demo-byggtid, och en{" "}
          <strong style={{ color: "var(--text-secondary)" }}>genererad SMS-text med
          kopiera-knapp</strong>. Systemet skickar aldrig — du kopierar och skickar från
          telefonen, och markerar &quot;skickat&quot; manuellt. Svar + ton loggas här.
        </p>
      </div>
    </>
  );
}
