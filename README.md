# KieselWesen

🇬🇧 [English version](README_EN.md)

## Was ist das?

**KieselWesen** ist eine kleine, lokale, beobachtbare Umgebung: Ein "Wesen"
mit einer inneren 3D-Struktur aus Knoten und Verbindungen ("Straßen")
lebt in einem Raum zusammen mit einer Katze, einer Pflanze und etwas
Krams. Erlebnisse in diesem Raum verändern die innere Struktur — sichtbar
in einem Live-Graphen.

Ziel ist ein verständlicher, funktionierender Kern: Raum → Ereignis →
innere Veränderung → Live-Darstellung → Persistenz über Neustarts hinweg.
Erst danach folgen Erweiterungen.

## Was das hier ausdrücklich nicht ist

- Kein Bewusstseinsclaim, keine AGI-Behauptung, kein Anspruch auf
  biologische Korrektheit oder Neuheit.
- Kein LLM, keine Sprache, keine Tool-Nutzung, keine externe
  Wissensbibliothek in dieser Bauphase.
- Keine feste Belohnungslogik ("richtig = Punkt / falsch = Strafe").
- Keine vorgegebene Persönlichkeit oder emotionsähnliche Zustände.

Die genaue Liste der bewusst gestrichenen Ideen und aller nicht
verhandelbaren Leitplanken steht im gemeinsamen Bauplan (Notion,
Agenten-Handoff).

## Verhältnis zur älteren Kiesel-Forschung

**KieselWesen** ist ein eigenständiges Bau-/Beobachtungsprojekt und von
der älteren, eingefrorenen Kiesel-Forschung (Hypothesenmatrix, v0.6–v0.8
Experimente) strikt getrennt. Diese Forschungshistorie ist nicht Teil
dieses Repos und wird hier nicht fortgeführt.

## Stand & Start

Der Code-Unterbau (Ereigniskern, inneres Datenmodell, Versuchsmotor,
Weltobjekte, Persistenz) liegt unter `src/domain/`. Die UI
(`index.html`, `styles.css`, `main.js`) ist eigenständig entwickelt;
`app.js` verbindet beide: Klicks auf Zimmerobjekte erzeugen echte
Ereignisse, die über den Versuchsmotor in Knoten/Kanten münden und live
im UI erscheinen — keine erfundenen Anzeigewerte.

App lokal starten:

```sh
npm install
npm run build:web   # bündelt src/domain für den Browser nach dist-browser/
python3 -m http.server 8000   # oder ein beliebiger anderer statischer Server
```

Danach `http://localhost:8000/index.html` im Browser öffnen. Ein reines
Öffnen der `index.html`-Datei per Doppelklick (`file://`) funktioniert
wegen ES-Modul-Beschränkungen der Browser nicht — es braucht einen
lokalen HTTP-Server.

Entwicklertests lokal ausführen:

```sh
npm install
npm run typecheck
npm test
```

Echte Browser-E2E-Tests (Erststart, Weltaktion, Speichern/Neustart,
Ruhephase, Mehrfach-Kiesel-Vergleich) ausführen:

```sh
npm run test:e2e
```

Lädt Playwrights eigenen Chromium herunter, falls noch keiner
vorhanden ist. Ist das in der Umgebung nicht möglich, kann ein bereits
installierter Chromium über `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/pfad/zu/chromium npm run test:e2e`
verwendet werden.

## Mac-Desktop-App (Tauri)

Für den lokalen Gebrauch ohne Terminal/HTTP-Server gibt es eine native
Mac-Anwendung, gebaut mit [Tauri](https://v2.tauri.app/): sie zeigt
exakt dieselbe Web-Oberfläche (`index.html`/`app.js`/`main.js`) in
einem eigenen Fenster, ohne eigene Logik. Getestet für Intel-Macs ab
macOS 10.15 (Catalina) — geeignet auch für ältere Geräte wie ein
MacBook (Intel Core i5) von 2015.

**Der Build muss auf einem Mac laufen** (Xcode-Kommandozeilenwerkzeuge
nötig) — er kann nicht aus einer Linux-Umgebung heraus für macOS
kompiliert werden.

Einmalig auf dem Mac einrichten:

```sh
xcode-select --install        # falls noch nicht installiert
curl https://sh.rustup.rs -sSf | sh    # Rust-Toolchain für Tauri
```

Danach reicht ein einziger Befehl, um eine fertige `.dmg`-Installationsdatei
zu bauen:

```sh
npm install
npm run package:dmg
```

Das Ergebnis liegt danach unter
`src-tauri/target/release/bundle/dmg/KieselWesen.dmg`. Diese Datei per
Doppelklick öffnen und die App in den `Programme`-Ordner ziehen —
danach startet KieselWesen wie jede andere Mac-App, ganz ohne Terminal
oder lokalen Server.

(`npm run package:dmg` baut die App und packt sie danach mit einem
eigenen, einfachen `hdiutil`-Skript in eine `.dmg` — nicht mit Tauris
eingebautem `.dmg`-Bundler, der auf manchen macOS-Versionen mit "Not
enough arguments" abbricht. Reicht dir die reine `.app`-Datei ohne
`.dmg`-Verpackung, genügt `npm run tauri:build`; sie liegt dann unter
`src-tauri/target/release/bundle/macos/KieselWesen.app`.)

Da die App nicht mit einem kostenpflichtigen Apple-Entwicklerzertifikat
signiert ist, warnt macOS Gatekeeper beim ersten Start. Abhilfe: im
Finder mit Rechtsklick auf die App → „Öffnen" wählen und im Dialog
bestätigen (nur beim allerersten Start nötig).

Zum Entwickeln mit Live-Fenster statt fertigem Installer:

```sh
npm run tauri:dev
```

## Lizenz

[PolyForm Noncommercial License 1.0.0](LICENSE).
