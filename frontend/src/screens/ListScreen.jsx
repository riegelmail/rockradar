import CragCard from "../components/CragCard";

// Secondary, ranked view: the same scored crags the map shows, but as a
// scrollable leaderboard. #1 gets the detailed treatment; the rest are still
// photo-led cards with the dominant status badge.
export default function ListScreen({
  rankedCrags,
  loading,
  error,
  nothingWorthDriving,
}) {
  if (loading && rankedCrags.length === 0) {
    return (
      <div className="screen-scroll list-screen">
        <ListSkeleton />
      </div>
    );
  }

  if (error && rankedCrags.length === 0) {
    return (
      <div className="screen-scroll list-screen">
        <div className="notice-card notice-error">{error}</div>
      </div>
    );
  }

  if (nothingWorthDriving || rankedCrags.length === 0) {
    return (
      <div className="screen-scroll list-screen">
        <div className="notice-card">
          <h2>Nothing worth the drive in range.</h2>
          <p>Try widening the drive time or changing the climbing style.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-scroll list-screen">
      <header className="screen-header">
        <h1>Ranked crags</h1>
        <p className="screen-subtitle">Best conditions near you, right now.</p>
      </header>

      <div className="card-stack">
        {rankedCrags.map((item, index) => (
          <CragCard
            key={item.name}
            item={item}
            rank={index + 1}
            detailed={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="card-stack">
      {[0, 1, 2].map((i) => (
        <div className="crag-card skeleton" key={i}>
          <div className="crag-media skeleton-block" />
          <div className="crag-body">
            <div className="skeleton-line skeleton-lg" />
            <div className="skeleton-line skeleton-md" />
            <div className="skeleton-line skeleton-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
