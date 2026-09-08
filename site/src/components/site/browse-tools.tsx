export const eraAnchor = (era: string) => `era-${era.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`;

export function Breadcrumbs({ items }: { items: { label: string; to?: string; hash?: string }[] }) {
  // Ancestor anchors must not inherit the router's prefix-matched aria-current.
  return <nav aria-label="Breadcrumb" className="breadcrumbs"><ol>
    <li><a href="/">Home</a></li>
    {items.map((item, i) => <li key={i}>
      <span aria-hidden="true">/</span>
      {item.to ? <a href={`${item.to}${item.hash ? `#${item.hash}` : ""}`}>{item.label}</a> : <span aria-current={i === items.length - 1 ? "page" : undefined}>{item.label}</span>}
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
