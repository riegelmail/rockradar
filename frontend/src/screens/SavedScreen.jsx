import handPhoto from "../assets/crags/hand.jpg";

// Placeholder. Favorites persistence is a later phase — this screen exists so
// the tab bar is complete and the empty state sets expectations.
export default function SavedScreen() {
  return (
    <div className="stub-screen">
      <img className="stub-hero" src={handPhoto} alt="" />
      <h2>Saved crags</h2>
      <p>
        Bookmark crags to track their conditions here. Favorites are coming in a
        later update — nothing is saved yet.
      </p>
    </div>
  );
}
