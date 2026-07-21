import PageHeader from "@/components/PageHeader";
import CopyBlock from "@/components/CopyBlock";
import { STATISTIK_DOCS } from "@/lib/statistik-docs";

/**
 * Cookies, GDPR & statistik — kopierbara dokument. Checklistan är intern (till dig),
 * lathundarna skickas kunden. Statiskt, läs-only.
 */
export default function StatistikPage() {
  return (
    <>
      <PageHeader
        title="Cookies, GDPR & statistik"
        sub="Checklistan är intern, lathundarna skickas till kunden"
      />
      <div style={{ maxWidth: 900 }}>
        {STATISTIK_DOCS.map((doc) => (
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
