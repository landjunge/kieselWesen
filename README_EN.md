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

Run real browser E2E tests (first start, world action, save/restart,
rest phase, multi-instance comparison):

```sh
npm run test:e2e
```

Downloads Playwright's own Chromium if none is present yet. If that
is not possible in your environment, an already installed Chromium can
be used via `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:e2e`.

## Mac desktop app (Tauri)

For local use without a terminal/HTTP server, there is a native Mac
app built with [Tauri](https://v2.tauri.app/): it shows the exact same
web UI (`index.html`/`app.js`/`main.js`) in its own window, with no
logic of its own. Tested for Intel Macs from macOS 10.15 (Catalina)
onward — suitable for older machines too, such as a 2015 MacBook with
an Intel Core i5.

**The build must run on a Mac** (Xcode command line tools required) —
it cannot be cross-compiled for macOS from a Linux environment.

One-time setup on the Mac:

```sh
xcode-select --install        # if not already installed
curl https://sh.rustup.rs -sSf | sh    # Rust toolchain for Tauri
```

After that, a single command builds a ready-to-use `.dmg` installer:

```sh
npm install
npm run package:dmg
```

The result lands at
`src-tauri/target/release/bundle/dmg/KieselWesen.dmg`. Open that file
by double-clicking and drag the app into the `Applications` folder —
KieselWesen then starts like any other Mac app, no terminal or local
server needed.

(`npm run package:dmg` builds the app and then packs it into a `.dmg`
with a small, self-contained `hdiutil` script — not Tauri's built-in
`.dmg` bundler, which fails with "Not enough arguments" on some macOS
versions. If the plain `.app` without `.dmg` packaging is enough,
`npm run tauri:build` alone is sufficient; it lands at
`src-tauri/target/release/bundle/macos/KieselWesen.app`.)

Since the app is not signed with a paid Apple developer certificate,
macOS Gatekeeper will warn on first launch. Fix: right-click the app
in Finder → "Open" and confirm in the dialog (only needed on the very
first launch).

To develop with a live window instead of a finished installer:

```sh
npm run tauri:dev
```

## License

[PolyForm Noncommercial License 1.0.0](LICENSE).
