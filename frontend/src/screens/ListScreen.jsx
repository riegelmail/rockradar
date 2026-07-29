import CragCard from "../components/CragCard";
import FilterBar from "../components/FilterBar";

function CardSkeleton() {
  return (
    <div className="crag-card skeleton">
      <div className="skeleton-photo" />
      <div className="crag-card-body">
        <div className="skeleton-line lg" />
        <div className="skeleton-line md" />
        <div className="skeleton-metrics">
          <div className="skeleton-box" />
          <div className="skeleton-box" />
          <div className="skeleton-box" />
        </div>
      </div>
    </div>
  );
}

// Ranked list — the secondary view. Same photo-led cards as the map sheet,
// shown in full and in score order.
export default function ListScreen({ ranked, loading, error, filterProps }) {
  return (
    <div className="list-screen">
      <div className="list-header">
        <FilterBar {...filterProps} />
        <h2 className="list-title">Ranked conditions</h2>
      </div>

      {error ? (
        <div className="sheet-message error">{error}</div>
      ) : loading && !ranked.length ? (
        <div className="crag-list">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : !ranked.length ? (
        <div className="sheet-message">
          Nothing worth the drive in range. Try widening the drive time or
          changing the climbing style.
        </div>
      ) : (
        <div className="crag-list">
          {ranked.map((crag, i) => (
            <CragCard key={crag.area} crag={crag} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
