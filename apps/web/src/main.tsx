import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";

function App() {
  return (
    <main className="min-h-screen bg-canvas-night text-white">
      <section className="flex min-h-screen items-end p-6 sm:p-10 lg:p-16">
        <div className="max-w-3xl">
          <p className="eyebrow mb-6 text-white/70">Faridpur · Dhaka · Bangladesh</p>
          <h1 className="display-xxl m-0">Brothers Sports Zone</h1>
          <p className="mt-8 max-w-xl text-base leading-7 tracking-[.32px] text-white/80">
            Football turf booking is coming online. Choose your slot, send your advance, and play under the lights.
          </p>
          <button className="ghost-button button-cap mt-8" type="button">Book a slot</button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
