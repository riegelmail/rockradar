import { formatForecastLabelClass } from "../lib/format";

// A compact 5-day drying outlook. Deliberately understated — this is
// secondary data, so it uses muted chips rather than the loud status colors.
export default function ForecastRow({ forecast }) {
  if (!forecast || forecast.length === 0) return null;

  return (
    <div className="forecast-row">
      {forecast.map((day, index) => (
        <div className="forecast-item" key={`${day.day}-${index}`}>
          <span className="forecast-day">{day.day}</span>
          <span
            className={`forecast-chip forecast-${formatForecastLabelClass(
              day.label
            )}`}
          >
            {day.label}
          </span>
        </div>
      ))}
    </div>
  );
}
