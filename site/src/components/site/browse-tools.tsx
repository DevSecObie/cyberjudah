import { Link } from "@tanstack/react-router";

export const eraAnchor = (era: string) => `era-${era.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`;

export function Breadcrumbs({ items }: { items: { label: string; to?: string; hash?: string }[] }) {
  return <nav aria-label="Breadcrumb" className="breadcrumbs"><ol>
    <li><Link to="/">Home</Link></li>
    {items.map((item, i) => <li key={i}>
      <span aria-hidden="true">/</span>
      {item.to ? <Link to={item.to as never} hash={item.hash}>{item.label}</Link> : <span aria-current={i === items.length - 1 ? "page" : undefined}>{item.label}</span>}
    </li>)}
  </ol></nav>;
}

export function ActiveFilters({ items, onClear }: { items: { id: string; label: string; remove: () => void }[]; onClear: () => void }) {
  if (!items.length) return null;
  return <div className="active-filters" role="group" aria-label="Active filters">
    {items.map((item) => <button key={item.id} type="button" className="chip chip--active" aria-label={`Remove ${item.label}`} onClick={item.remove}>
      {item.label} <span aria-hidden="true">×</span>
    </button>)}
    <button type="button" className="chip" onClick={onClear}>Clear all</button>
  </div>;
}
