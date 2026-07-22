import PageHeader from "@/components/PageHeader";
import SweepPlanner from "@/components/SweepPlanner";

/** Insamling — svep-planerare: välj kommuner × branscher → köa → n8n betar av i bakgrunden. */
export default function LeadsInsamlingPage() {
  return (
    <>
      <PageHeader
        title="Insamling"
        sub="Välj geografi + branscher → köa svep. n8n betar av kön i bakgrunden inom dygnsbudgeten."
      />
      <SweepPlanner />
    </>
  );
}
