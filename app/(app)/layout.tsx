import Sidebar from "@/components/Sidebar";

/**
 * App-shell för hela det inloggade gränssnittet: sidebar + bred innehållsyta.
 * Middleware gatar redan alla routes här. /login ligger UTANFÖR denna grupp och
 * får därför ingen sidebar.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}
