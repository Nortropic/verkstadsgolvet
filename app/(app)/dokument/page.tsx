import PageHeader from "@/components/PageHeader";
import DocPanel from "@/components/DocPanel";

export default function DokumentPage() {
  return (
    <>
      <PageHeader title="Dokument" sub="Bläddra filerna i Workflow-repot och kund-repon (läs-only)" />
      <DocPanel />
    </>
  );
}
