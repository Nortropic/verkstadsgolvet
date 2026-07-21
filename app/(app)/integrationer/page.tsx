import PageHeader from "@/components/PageHeader";
import CopyBlock from "@/components/CopyBlock";
import { INTEGRATIONER_DOCS } from "@/lib/integrationer-docs";

/**
 * Integrationer — intern översikt över tjänster/integrationer att känna till.
 * Till dig, statiskt, läs-only.
 */
export default function IntegrationerPage() {
  return (
    <>
      <PageHeader
        title="Integrationer"
        sub="Tjänster & integrationer att känna till — vad som passar din stack"
      />
      <div style={{ maxWidth: 900 }}>
        {INTEGRATIONER_DOCS.map((doc) => (
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
