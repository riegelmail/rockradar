const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSe0vPydbp7trY2-2SLmEkKt20pmFosd7CUlosIi3tYv0VL0PA/viewform?usp=header";

// Profile tab. Home base (which every score is measured from) lives here so
// the Map/List tabs stay focused on conditions. Accounts/personalisation are
// a later phase — for now this is home base + app info.
export default function ProfileView({
  homeInput,
  onHomeInput,
  onApplyHome,
  activeHome,
}) {
  return (
    <div className="profile-view">
      <section className="profile-card">
        <h2>Home base</h2>
        <p className="profile-help">
          Drive times are measured from here. Enter a zip or city, state.
        </p>
        <form
          className="home-row"
          onSubmit={(e) => {
            e.preventDefault();
            onApplyHome();
          }}
        >
          <input
            type="text"
            value={homeInput}
            onChange={(e) => onHomeInput(e.target.value)}
            placeholder="98101 or Seattle, WA"
            aria-label="Home base"
          />
          <button type="submit">Update</button>
        </form>
        {activeHome && (
          <p className="profile-active">
            Currently using <strong>{activeHome}</strong>
          </p>
        )}
      </section>

      <section className="profile-card">
        <h2>About RockRadar</h2>
        <p className="profile-help">
          RockRadar reads live weather at each crag and scores whether the rock
          is likely dry enough to climb — so you can point the car at the right
          place instead of guessing.
        </p>
        <a
          className="text-link"
          href={FEEDBACK_URL}
          target="_blank"
          rel="noreferrer"
        >
          What would make this more sendy? →
        </a>
      </section>

      <section className="stub-view profile-stub">
        <div className="stub-icon" aria-hidden="true">◔</div>
        <h2>Accounts</h2>
        <p>Sign-in, saved crags, and alerts are on the way.</p>
        <span className="stub-tag">Coming soon</span>
      </section>
    </div>
  );
}
