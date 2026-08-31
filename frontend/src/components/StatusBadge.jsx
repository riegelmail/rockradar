import { statusKey, statusLabel } from "../lib/status";

// The single most dominant UI element after the photo: Go / Maybe / No-Go.
export default function StatusBadge({ goStatus, size = "md" }) {
  return (
    <span className={`status-badge status-${statusKey(goStatus)} status-${size}`}>
      {statusLabel(goStatus)}
    </span>
  );
}
