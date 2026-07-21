import PageHeader from "@/components/PageHeader";
import NattmanPanel from "@/components/NattmanPanel";

export default function NattmannenPage() {
  return (
    <>
      <PageHeader title="Nattmannen" sub="Autonom självförbättring — AUTOPILOT och N2" />
      <div style={{ maxWidth: 640 }}>
        <NattmanPanel />
      </div>
    </>
  );
}
