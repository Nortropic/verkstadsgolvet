import PageHeader from "@/components/PageHeader";
import DoctorPanel from "@/components/DoctorPanel";

export default function DoktornPage() {
  return (
    <>
      <PageHeader title="Doktorn" sub="Systemets 12 hälsokontroller" />
      <div style={{ maxWidth: 640 }}>
        <DoctorPanel />
      </div>
    </>
  );
}
