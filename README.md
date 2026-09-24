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

## Lizenz

[PolyForm Noncommercial License 1.0.0](LICENSE).
