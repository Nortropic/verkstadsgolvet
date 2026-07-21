import PageHeader from "@/components/PageHeader";
import RetroPanel from "@/components/RetroPanel";

export default function RetroPage() {
  return (
    <>
      <PageHeader title="Retro-kö" sub="Öppna ärenden per tier" />
      <div style={{ maxWidth: 640 }}>
        <RetroPanel />
      </div>
    </>
  );
}
