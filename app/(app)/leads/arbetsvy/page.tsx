import PageHeader from "@/components/PageHeader";
import Arbetsvy from "@/components/Arbetsvy";

/** Arbetsvy — flödet kvalificerad → demo → kontaktad → svar → möte, med SMS-mall (kopiera, ej skicka). */
export default function LeadsArbetsvyPage() {
  return (
    <>
      <PageHeader
        title="Arbetsvy"
        sub="Flödet: kvalificerad → demo byggd → kontaktad → svar → möte. SMS genereras — du skickar själv."
      />
      <Arbetsvy />
    </>
  );
}
