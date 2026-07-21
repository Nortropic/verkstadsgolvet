import PageHeader from "@/components/PageHeader";
import DoctorPanel from "@/components/DoctorPanel";
import RetroPanel from "@/components/RetroPanel";
import NattmanPanel from "@/components/NattmanPanel";

// Systemhälsa — översikt över de tre hälso-panelerna (drill-down i sidebar-gruppen).
export default function SystemhalsaPage() {
  return (
    <>
      <PageHeader title="Systemhälsa" sub="Doktorn, retro-kö och nattmannen" />
      <div className="sysrow">
        <DoctorPanel />
        <RetroPanel />
        <NattmanPanel />
      </div>
    </>
  );
}
