:root {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1f2937;
  background: #eaf1f7;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(125, 211, 252, 0.45), transparent 35%),
    radial-gradient(circle at top right, rgba(147, 197, 253, 0.35), transparent 30%),
    linear-gradient(180deg, #eef4f8 0%, #dde7ef 100%);
  min-height: 100vh;
  color: #1f2937;
}

#root {
  min-height: 100vh;
}

.app-shell {
  min-height: 100vh;
  padding: 28px 16px 56px;
}

.container {
  max-width: 980px;
  margin: 0 auto;
}

.hero-card,
.controls-card,
.top-pick-card,
.alternate-card {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 35px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  margin-bottom: 20px;
}

.hero-text h1 {
  margin: 0 0 10px;
  font-size: clamp(2.6rem, 7vw, 4.4rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  color: #1d3557;
}

.hero-subtitle {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.5;
  color: #475569;
  max-width: 560px;
}

.eyebrow {
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #3b82f6;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.08);
  color: #1e3a8a;
  font-weight: 700;
  font-size: 0.95rem;
}

.hero-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.hero-icon {
  width: 96px;
  height: 96px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  font-size: 3rem;
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
}

.controls-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  padding: 20px;
  margin-bottom: 24px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-group label {
  font-size: 0.92rem;
  font-weight: 800;
  color: #334155;
  letter-spacing: 0.01em;
}

.control-group select {
  width: 100%;
  border: 1px solid #dbe4ee;
  background: #fff;
  border-radius: 16px;
  padding: 14px 16px;
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
}

.top-pick-card {
  padding: 28px;
  margin-bottom: 26px;
}

.section-heading h2 {
  margin: 0;
  font-size: 2rem;
  color: #1f2937;
}

.crag-name {
  margin: 18px 0 0;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: #0f172a;
}

.stats-grid {
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.stat-box {
  padding: 16px 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef5fb 100%);
  border: 1px solid #dce8f2;
}

.stat-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
}

.conditions-card,
.why-card {
  margin-top: 18px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid #e2e8f0;
}

.conditions-card h4,
.why-card h4 {
  margin: 0 0 14px;
  font-size: 1rem;
  color: #1e293b;
}

.conditions-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.condition-pill {
  padding: 14px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.condition-pill span {
  display: block;
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 4px;
}

.condition-pill strong {
  font-size: 1rem;
  color: #0f172a;
}

.why-card p {
  margin: 0;
  line-height: 1.6;
  color: #475569;
}

.alternates-section {
  margin-top: 8px;
}

.alternates-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.alternate-card {
  padding: 22px;
}

.alternate-card h3 {
  margin: 0 0 14px;
  font-size: 1.35rem;
  line-height: 1.2;
  color: #0f172a;
}

.alternate-stat {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid #e8eef5;
}

.alternate-stat span {
  color: #64748b;
  font-weight: 700;
}

.alternate-stat strong {
  color: #0f172a;
}

.alternate-why {
  margin: 16px 0 0;
  color: #475569;
  line-height: 1.55;
}

.loading-card {
  text-align: center;
}

.loading-card h1 {
  font-size: 2rem;
  margin: 0;
}

@media (max-width: 768px) {
  .app-shell {
    padding: 18px 12px 36px;
  }

  .hero-card {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px;
  }

  .hero-icon-wrap {
    min-width: auto;
  }

  .controls-card,
  .stats-grid,
  .conditions-grid,
  .alternates-grid {
    grid-template-columns: 1fr;
  }

  .top-pick-card {
    padding: 22px;
  }

  .crag-name {
    font-size: 2.2rem;
  }

  .section-heading h2 {
    font-size: 1.7rem;
  }
}