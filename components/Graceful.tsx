/**
 * Delad graceful-state-ruta. Används av paneler vars källdata ännu inte produceras
 * (agent-loggar, doctor-output, retro-inbox, AUTO-DIGEST, Graphify). Ärligt läge —
 * aldrig fejkdata (system-/research-invarianten: fabricera aldrig).
 */
export default function Graceful({
  title,
  children,
  hint,
}: {
  title: string;
  children?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="state">
      <div className="st-title">{title}</div>
      {children}
      {hint && <div className="st-hint">{hint}</div>}
    </div>
  );
}
