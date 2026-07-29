import handPhoto from "../assets/crags/hand.jpg";

const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSe0vPydbp7trY2-2SLmEkKt20pmFosd7CUlosIi3tYv0VL0PA/viewform?usp=header";

// Stub profile: keeps the branding (hero hand photo) and hosts the trip
// settings + feedback link. No accounts — those come in a later phase.
export default function ProfileScreen({
  homeInput,
  setHomeInput,
  onApplyHome,
  maxHours,
  setMaxHours,
  style,
  setStyle,
}) {
  return (
    <div className="profile-screen">
      <div className="profile-brand">
        <img className="profile-hero" src={handPhoto} alt="climbing hand on rock" />
        <div>
          <h1 className="profile-wordmark">RockRadar</h1>
          <p className="profile-tagline">Find the best conditions near you.</p>
        </div>
      </div>

      <section className="profile-section">
        <h2>Trip settings</h2>

        <label className="filter-field filter-field-wide">
          <span>Home base</span>
          <div className="filter-home-row">
            <input
              type="text"
              value={homeInput}
              onChange={(e) => setHomeInput(e.target.value)}
              placeholder="98101 or Seattle, WA"
            />
            <button type="button" onClick={onApplyHome}>
              Update
            </button>
          </div>
        </label>

        <div className="filter-field-row">
          <label className="filter-field">
            <span>Max drive</span>
            <select
              value={maxHours}
              onChange={(e) => setMaxHours(Number(e.target.value))}
            >
              <option value="1">1 hour</option>
              <option value="2">2 hours</option>
              <option value="3">3 hours</option>
              <option value="4">4 hours</option>
              <option value="6">6 hours</option>
              <option value="8">8 hours</option>
            </select>
          </label>

          <label className="filter-field">
            <span>Style</span>
            <select value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="all">All</option>
              <option value="sport">Sport</option>
              <option value="trad">Trad</option>
              <option value="bouldering">Bouldering</option>
            </select>
          </label>
        </div>
      </section>

      <section className="profile-section">
        <h2>Account</h2>
        <p className="profile-muted">
          Accounts and notifications aren't available yet. For now everything
          runs on this device.
        </p>
      </section>

      <a
        className="profile-feedback"
        href={FEEDBACK_URL}
        target="_blank"
        rel="noreferrer"
      >
        What would make this more sendy?
      </a>
    </div>
  );
}
