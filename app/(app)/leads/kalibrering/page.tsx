import PageHeader from "@/components/PageHeader";

/** Scaffold — Fas 6 fyller detta med kalibreringsrapporten. */
export default function LeadsKalibreringPage() {
  return (
    <>
      <PageHeader
        title="Kalibrering"
        sub="Funkar modellen? Svarsfrekvens per score-intervall — och skruva vikterna"
      />
      <div className="panel" style={{ maxWidth: 720 }}>
        <h2>
          <span className="idx">◆</span> Byggs — Fas 6
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 10, lineHeight: 1.65 }}>
          Svarsfrekvens per score-intervall, vilka signaler som korrelerar med positivt svar,
          falska positiva (höga scores som inte svarade) och snittid per demo. Redigerbara
          vikter → skapar en ny <code>score_version</code> att jämföra mot den gamla.
        </p>
        <p style={{ color: "var(--text-muted)", marginTop: 10, lineHeight: 1.65 }}>
          v1-vikterna är medvetet gissningar. Granska mot faktiska utfall månadsvis första
          kvartalet — efter ~15 utfall börjar den här vyn säga något.
        </p>
      </div>
    </>
  );
}
