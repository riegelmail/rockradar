import CragCard from "./CragCard";
import { toRankedCrags } from "../lib/status";

function ListSkeleton() {
  return (
    <div className="list-view">
      {[1, 2, 3].map((n) => (
        <div className="crag-card skeleton-card" key={n}>
          <div className="skeleton-photo-lg" />
          <div className="crag-card-body">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-stats-row">
              <div className="skeleton-box" />
              <div className="skeleton-box" />
              <div className="skeleton-box" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ListView({ data, loading }) {
  const ranked = toRankedCrags(data);
  const nothingWorthDriving =
    data?.best_area === "Nothing worth the drive in range.";

  if (loading && !data) return <ListSkeleton />;

  if (nothingWorthDriving) {
    return (
      <div className="list-view">
        <div className="empty-state">
          <h2>Nothing worth the drive in range.</h2>
          <p>{data?.signal_summary || "Try widening drive time or changing the style."}</p>
        </div>
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="list-view">
        <div className="empty-state">
          <h2>No conditions yet</h2>
          <p>Pick a home base and drive time to see ranked crags.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="list-view">
      {ranked.map((crag, index) => (
        <CragCard key={crag.area} crag={crag} defaultOpen={index === 0} />
      ))}
    </div>
  );
}
