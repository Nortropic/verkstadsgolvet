import PageHeader from "@/components/PageHeader";
import Kalibrering from "@/components/Kalibrering";

/** Kalibrering — svarsfrekvens per score-intervall + modellvikter. Funkar modellen? */
export default function LeadsKalibreringPage() {
  return (
    <>
      <PageHeader
        title="Kalibrering"
        sub="Funkar scoring-modellen? Svarsfrekvens per score-intervall — skruva vikterna mot verkligheten"
      />
      <Kalibrering />
    </>
  );
}
