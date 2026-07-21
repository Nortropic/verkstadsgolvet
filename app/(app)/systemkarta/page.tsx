import PageHeader from "@/components/PageHeader";
import SystemMapPanel from "@/components/SystemMapPanel";
import EffektPanel from "@/components/EffektPanel";

export default function SystemkartaPage() {
  return (
    <>
      <PageHeader title="Systemkarta" sub="Graphify-driven karta och dess effekt" />
      <div className="sysmap-row">
        <SystemMapPanel />
        <EffektPanel />
      </div>
    </>
  );
}
