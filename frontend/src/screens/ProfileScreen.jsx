import { useState } from "react";
import handPhoto from "../assets/crags/hand.jpg";

const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSe0vPydbp7trY2-2SLmEkKt20pmFosd7CUlosIi3tYv0VL0PA/viewform?usp=header";

// Profile / settings. Stub for account features, but it's also the natural
// home for the one persistent setting the app already has: the home base
// used to compute drive times. Keeps the minimal branding (the hero hand
// photo) that the app has always led with.
export default function ProfileScreen({ home, onApplyHome }) {
  const [homeInput, setHomeInput] = useState(home || "");

  function submit(e) {
    e.preventDefault();
    const trimmed = homeInput.trim();
    if (trimmed) onApplyHome(trimmed);
  }

  return (
    <div className="screen-scroll profile-screen">
      <div className="profile-hero">
        <img src={handPhoto} alt="climbing hand on rock" className="profile-hero-photo" />
        <div className="profile-hero-text">
          <h1>RockRadar</h1>
          <p>Find the best conditions near you.</p>
        </div>
      </div>

      <form className="settings-card" onSubmit={submit}>
        <label className="settings-label" htmlFor="home-base">
          Home base
        </label>
        <p className="settings-hint">Zip or city, state — used to estimate drive times.</p>
        <div className="settings-row">
          <input
            id="home-base"
            type="text"
            value={homeInput}
            onChange={(e) => setHomeInput(e.target.value)}
            placeholder="98101 or Seattle, WA"
          />
          <button type="submit">Update</button>
        </div>
        {home ? <p className="settings-current">Current: {home}</p> : null}
      </form>

      <div className="settings-card settings-stub">
        <h2>Account</h2>
        <p>Accounts, saved crags, and condition alerts are coming in a later release.</p>
      </div>

      <a className="feedback-link" href={FEEDBACK_URL} target="_blank" rel="noreferrer">
        What would make this more sendy?
      </a>
    </div>
  );
}
