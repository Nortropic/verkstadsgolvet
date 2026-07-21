import PageHeader from "@/components/PageHeader";
import CopyBlock from "@/components/CopyBlock";
import { MARKNADSFORING_DOCS } from "@/lib/marknadsforing-docs";

/**
 * Marknadsföring — kopierbara annonsguider (alla till kunden). Statiskt, läs-only.
 */
export default function MarknadsforingPage() {
  return (
    <>
      <PageHeader
        title="Marknadsföring"
        sub="Guider att skicka kunden — annonskanaler, Google Ads och Meta"
      />
      <div style={{ maxWidth: 900 }}>
        {MARKNADSFORING_DOCS.map((doc) => (
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
