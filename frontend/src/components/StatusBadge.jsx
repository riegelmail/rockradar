import { statusInfo } from "../lib/crags";

// The dominant visual signal after the photo. `size` bumps type + padding so
// the same component works as a hero badge on a card and a chip in a list.
export default function StatusBadge({ status, size = "md" }) {
  const info = statusInfo(status);
  return (
    <span className={`status-badge status-${info.key} status-badge-${size}`}>
      <span className="status-dot" aria-hidden="true" />
      {info.label}
    </span>
  );
}
