import PageHeader from "@/components/PageHeader";
import CopyBlock from "@/components/CopyBlock";
import { FRAMTIDEN_DOCS } from "@/lib/framtiden-docs";

/**
 * Framtiden — Nortropics strategi/roadmap-dokument. Interna (till dig), statiskt, läs-only.
 */
export default function FramtidenPage() {
  return (
    <>
      <PageHeader
        title="Framtiden"
        sub="Nortropics strategi och roadmap — vart erbjudandet är på väg"
      />
      <div style={{ maxWidth: 900 }}>
        {FRAMTIDEN_DOCS.map((doc) => (
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
