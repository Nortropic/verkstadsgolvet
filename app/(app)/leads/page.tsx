import { redirect } from "next/navigation";

/** /leads → kvalificeringslistan (modulens hem). */
export default function LeadsIndexPage() {
  redirect("/leads/lista");
}
