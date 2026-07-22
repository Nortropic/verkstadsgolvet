import PageHeader from "@/components/PageHeader";
import LeadsList from "@/components/LeadsList";

/** Kvalificeringslistan — leads sorterade på score, expanderbar score-uppdelning per rad. */
export default function LeadsListaPage() {
  return (
    <>
      <PageHeader
        title="Kvalificering"
        sub="Leads sorterade på score — klicka en rad för att se varför den fick sin poäng"
      />
      <LeadsList />
    </>
  );
}
