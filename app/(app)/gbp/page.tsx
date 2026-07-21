import PageHeader from "@/components/PageHeader";
import CopyBlock from "@/components/CopyBlock";
import { GBP_DOCS } from "@/lib/gbp-docs";

/**
 * Google Business Profile — kopierbara dokument. Prompten (till dig) klistras i
 * Claude-i-browsern; guiderna (till kunden) skickas vidare. Statiskt, läs-only.
 */
export default function GbpPage() {
  return (
    <>
      <PageHeader
        title="Google Business Profile"
        sub="Kopiera prompten till Claude-i-browsern, guiderna till kunden"
      />
      <div style={{ maxWidth: 900 }}>
        {GBP_DOCS.map((doc) => (
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
