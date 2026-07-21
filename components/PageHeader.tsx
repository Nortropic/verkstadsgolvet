/**
 * Per-sektion sidhuvud i Console-stil (serif-titel + valfri undertext/högeraktion).
 */
export default function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="ph-row">
        <h1>{title}</h1>
        {right}
      </div>
      {sub && <div className="ph-sub">{sub}</div>}
    </div>
  );
}
