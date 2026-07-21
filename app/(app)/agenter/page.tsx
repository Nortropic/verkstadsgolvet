import PageHeader from "@/components/PageHeader";
import AgentPanel from "@/components/AgentPanel";
import OvertimePanel from "@/components/OvertimePanel";

export default function AgenterPage() {
  return (
    <>
      <PageHeader title="Agenter" sub="Arbetsloggar per agent och återkommande friktion över tid" />
      <AgentPanel />
      <OvertimePanel />
    </>
  );
}
