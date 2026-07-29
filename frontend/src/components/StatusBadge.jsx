import { statusFromGoStatus } from "../lib/format";

// The dominant Go / Maybe / No-Go badge. Size variants:
//   "lg"  — hero on a card, most visually dominant element after the photo
//   "md"  — default
//   "sm"  — inline / list rows
export default function StatusBadge({ goStatus, size = "md", className = "" }) {
  const status = statusFromGoStatus(goStatus);
  return (
    <span
      className={`status-badge status-${status.key} status-${size} ${className}`}
    >
      <span className="status-dot" aria-hidden="true" />
      {status.label}
    </span>
  );
}
