import PageHeader from "@/components/PageHeader";

/** Scaffold — Fas 3 fyller detta med formuläret som triggar n8n. */
export default function LeadsInsamlingPage() {
  return (
    <>
      <PageHeader
        title="Insamling"
        sub="Sök bransch + ort → n8n hämtar kandidater från Places till Supabase"
      />
      <div className="panel" style={{ maxWidth: 720 }}>
        <h2>
          <span className="idx">◆</span> Byggs — Fas 3
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 10, lineHeight: 1.65 }}>
          Här kommer formuläret: välj bransch (Ring 1) + ort → det POSTar till{" "}
          <code>/api/leads/collect</code> som triggar n8n-flödet. n8n gör Places-sökningen,
          filtrerar (ingen sajt + har recensioner), hämtar Place Details och upsertar
          kandidater till Supabase på <code>place_id</code>. Sedan visas de här.
        </p>
        <p style={{ color: "var(--text-muted)", marginTop: 10, lineHeight: 1.65 }}>
          Kräver infra på plats: kör <code>db/leads-schema.sql</code> i Supabase och bygg
          n8n-flödet enligt <code>db/n8n-leads-flow.md</code>.
        </p>
      </div>
    </>
  );
}
