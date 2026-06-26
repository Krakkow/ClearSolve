import { SpotConfig } from '../ui/SpotConfig';
import { ResultPanel } from '../ui/ResultPanel';
import './app.css';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>
          Clear<span className="accent">Solve</span>
        </h1>
        <p className="tagline">
          Preflop GTO Solver — 2–9 handed cash · CFR+ · HU live, multiway estimate
        </p>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <SpotConfig />
        </aside>
        <div className="content">
          <ResultPanel />
        </div>
      </main>

      <footer className="app-footer">
        Pure client-side · no backend · deterministic seeded solve · interim TypeScript
        engine (Rust→WASM swap-in via the SolverEngine port)
      </footer>
    </div>
  );
}
