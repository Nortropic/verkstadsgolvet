import PageHeader from "@/components/PageHeader";
import CopyBlock from "@/components/CopyBlock";
import { YOUTUBE_RESEARCH_DOCS } from "@/lib/youtube-research-docs";

/**
 * YouTube research — referenssida för destilleringsflödet (manual + prompt, kopierbara).
 * Läs-only: sidan visar dokumenten, den kör inget. Själva flödet lever vid skrivbordet
 * i Claude Code (~/Workflow), inte här — dashboarden speglar bara systemet.
 */
export default function YoutubeResearchPage() {
  return (
    <>
      <PageHeader
        title="YouTube research"
        sub="Destillera byggvideor mot systemet — manual + prompt (kör flödet i Claude Code, inte här)"
      />
      <div style={{ maxWidth: 900 }}>
        {YOUTUBE_RESEARCH_DOCS.map((doc) => (
          <CopyBlock
            key={doc.id}
            title={doc.title}
            description={doc.description}
            audience={doc.audience}
            content={doc.content}
          />
        ))}
      </div>
    </>
  );
}
