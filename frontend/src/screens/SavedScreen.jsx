// Placeholder for a later phase. Favorites persistence, accounts, and
// notifications are intentionally out of scope for this visual rework — this
// screen just reserves the tab and sets the expectation.
export default function SavedScreen() {
  return (
    <div className="screen-scroll stub-screen">
      <div className="stub-illustration" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1>Saved crags</h1>
      <p className="stub-copy">
        Bookmark your go-to crags to see their conditions at a glance. Saving
        is coming in a later release.
      </p>
    </div>
  );
}
