import PageHeader from "@/components/PageHeader";
import ProcessGuide from "@/components/ProcessGuide";
import PipelinePanel from "@/components/PipelinePanel";
import MetricsPanel from "@/components/MetricsPanel";

// Översikt ("/") — process, löpande band och nyckeltal.
export default function Oversikt() {
  return (
    <>
      <PageHeader title="Översikt" sub="Var bygget står och vad som händer härnäst" />
      <ProcessGuide />
      <div className="bottom">
        <PipelinePanel />
        <MetricsPanel />
      </div>
    </>
  );
}
