import { outlookClass } from "../lib/status";

// Compact 5-day drying outlook. Each day shows a Dry/Drying/Wet pill —
// deliberately small and secondary to the headline status.
export default function ForecastRow({ forecast }) {
  if (!forecast || forecast.length === 0) return null;

  return (
    <div className="forecast-row">
      {forecast.map((day, index) => (
        <div className="forecast-cell" key={`${day.day}-${index}`}>
          <span className="forecast-day">{day.day}</span>
          <span className={outlookClass(day.label)}>{day.label}</span>
          {typeof day.high_f === "number" && (
            <span className="forecast-temp">{Math.round(day.high_f)}°</span>
          )}
        </div>
      ))}
    </div>
  );
}
