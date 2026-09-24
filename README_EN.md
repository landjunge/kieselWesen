# KieselWesen

🇩🇪 [Deutsche Version](README.md)

## What is this?

**KieselWesen** ("pebble being") is a small, local, observable
environment: a "being" with an inner 3D structure of nodes and
connections ("roads") lives in a room together with a cat, a plant, and
some clutter. Experiences in that room change the inner structure —
visible in a live graph.

The goal is an understandable, working core loop: room → event → inner
change → live view → persistence across restarts. Extensions come only
after that.

## What this explicitly is not

- No claim of consciousness, no AGI claim, no claim of biological
  accuracy or novelty.
- No LLM, no language, no tool use, no external knowledge library in
  this build phase.
- No fixed reward logic ("correct = point / wrong = penalty").
- No predefined personality or emotion-like states.

The exact list of deliberately dropped ideas and all non-negotiable
guardrails lives in the shared build plan (Notion, agent handoff).

## Relation to the earlier Kiesel research

**KieselWesen** is a standalone build/observation project, strictly
separate from the earlier, frozen Kiesel research track (hypothesis
matrix, v0.6–v0.8 experiments). That research history is not part of
this repo and is not continued here.

## Status & getting started

The code substrate (event core, inner data model, experiment engine,
world objects, persistence) lives under `src/domain/`. The UI
(`index.html`, `styles.css`, `main.js`) was developed independently;
`app.js` wires both together: clicking room objects creates real
events that flow through the experiment engine into nodes/edges and
appear live in the UI — no fabricated display values.

Run the app locally:

```sh
npm install
npm run build:web   # bundles src/domain for the browser into dist-browser/
python3 -m http.server 8000   # or any other static file server
```

Then open `http://localhost:8000/index.html` in a browser. Opening
`index.html` directly by double-clicking it (`file://`) does not work
due to browser ES module restrictions — it needs a local HTTP server.

Run developer tests locally:

```sh
npm install
npm run typecheck
npm test
```

## License

[PolyForm Noncommercial License 1.0.0](LICENSE).
