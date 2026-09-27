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

### Fertige Datei herunterladen (kein Terminal nötig)

Die neueste `KieselWesen.dmg` wird automatisch gebaut, sobald sich an
`main` etwas ändert, und liegt immer aktuell auf der Release-Seite
["aktuell"](../../releases/tag/aktuell) — dort einfach die `.dmg`-Datei
herunterladen, per Doppelklick öffnen und die App in den
`Programme`-Ordner ziehen. Diese Datei ist gezielt für Intel-Macs
gebaut (x86_64) — der automatische Bau läuft zwar auf einem
Apple-Silicon-Rechner bei GitHub, kompiliert aber bewusst für Intel, da
das die Zielhardware ist (siehe `.github/workflows/build-dmg.yml`). Auf
einem Apple-Silicon-Mac läuft sie ebenfalls, über Rosetta.

### Selbst bauen (nur bei Bedarf)

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

## LLM-Vorschläge: nur aus dem Ereignisprotokoll, nie aus dem Graphen

**Warum diese Trennung wichtig ist.** Ein LLM (egal ob lokal über Ollama
oder über die Cloud) soll Kiesel bei Bedarf einen Vorschlag machen können,
was als Nächstes passieren könnte. Bekäme das LLM dafür Zugriff auf den
inneren Graphen (Kanten, Kantenstärke, Aktivierung), entstünde eine
Zirkularität: der Graph beeinflusst den Vorschlag, der Vorschlag würde nach
Bestätigung wieder den Graphen/Lerner beeinflussen — das LLM würde am Ende
im Kreis lernen, was es selbst mitgeformt hat, statt etwas Neues aus
echten Ereignissen abzuleiten. Deshalb bekommt das LLM-Modul ausschließlich
das Ereignisprotokoll als Kontext, nie den Graphen.

**Der Datenfluss:**

1. **`readEventLog(log, limit)`** (`src/domain/eventLog.ts`) liefert die
   letzten `limit` Ereignisse — nur Zeitstempel, Ereignistyp und beteiligte
   Objekte. Kein Zugriff auf Kanten, Stärken, Aktivierung oder sonst etwas
   aus `InnerModelState`. Das ist die **einzige** Schnittstelle, über die
   ein LLM Kontext bekommen darf.
2. Der Prompt-Builder (`startLlmRound` in `app.js`) baut daraus den Prompt
   und sagt dem LLM ausdrücklich: *"Schlage nur vor, was aus diesen
   Ereignissen folgt — nicht, was passieren wird."*
3. Jeder Vorschlag trägt eine verpflichtende **`source`-Angabe**
   (`event_log` oder `graph`, siehe `src/domain/llmSuggestions.ts`).
   `addSuggestion` lehnt einen Vorschlag ohne gültige `source` ab.
   `classifySuggestionSource` prüft die Antworttext zusätzlich auf
   erkennbares Graph-Vokabular (z.B. "Kante", "Stärke") — ein LLM kann sich
   trotz reinem Ereignis-Kontext etwas ausdenken. Erkennt die Prüfung
   solches Vokabular, wird der Vorschlag als `source: "graph"` markiert.
4. **Nur `source: "event_log"`-Vorschläge lassen sich bestätigen.**
   `confirmSuggestion` verändert einen `"graph"`-Vorschlag nie zu
   `"confirmed"` — er bleibt sichtbar (Transparenz), landet aber nie im
   Lernschritt des Mini-Lerners.
5. **Abgelehnte Vorschläge werden nicht gelöscht.** Sowohl ein von Hand
   verworfener als auch ein automatisch abgelehnter Vorschlag (z.B. weil
   die Antwort keinen bekannten Ort nennt) wird über
   `appendRejectedSuggestionEvent` als eigene Ereignisart
   (`rejected_suggestion`) ins Protokoll geschrieben — mit Zeitstempel,
   Vorschlagstext und optionaler Begründung. `readEventLog` liefert diese
   Einträge mit aus, damit ein späterer LLM-Durchlauf sieht, was schon
   versucht wurde, und dieselbe Idee nicht wiederholt.
6. **Manueller Takt.** Ein LLM-Durchlauf startet ausschließlich über
   `startLlmRound(client, modelName)` — aufgerufen nur aus den beiden
   "Um Rat fragen"-Buttons im Tab "Vorschläge". Es gibt keinen Scheduler
   und keinen automatischen Trigger bei Ereignissen (Objektberührung,
   Ruhephase o.ä.): der Mensch ist der Taktgeber.
7. **Fallback.** Die Engine, der Mini-Lerner und alle übrigen Funktionen
   laufen unabhängig vom LLM weiter. Schlägt ein LLM-Durchlauf fehl
   (Netzwerkfehler, Ollama nicht erreichbar, ungültiger Schlüssel), wird
   der Fehler nur als Hinweis angezeigt — `run.model`/`run.log`/
   `run.learner` bleiben unverändert, kein Abbruch, kein Fehlerzustand, der
   sich fortpflanzt.

Nicht verändert durch diese Trennung: die Engine-Regeln
(`experimentEngine.ts`), der Mini-Lerner (`miniLearner.ts`) und die
Bestätigungs-Logik selbst (`confirmSuggestion`/`rejectSuggestion` als
Statusübergänge) bleiben wie zuvor.

## Fünf Erweiterungen: Verblassen, Vergleich, Verdichtung, Zeitstempel, Export

### 1. Kanten-Verblassen ist an Ereignisse gekoppelt, nicht an feste Zeit

Bisher ließ ein Ruheschritt (`runRestStep`) **jede** Kante im Graphen um
einen festen Betrag verblassen, unabhängig davon, ob sie gerade etwas mit
dem Geschehen zu tun hatte — praktisch eine feste Zeitspanne. Das ist jetzt
anders: `applyEventEdgeFade(state, config, at, eventId, participantIds)`
(`experimentEngine.ts`) prüft bei einem Ereignis, welche vorhandenen Kanten
mindestens einen der beteiligten Knoten berühren, und lässt **nur diese**
verblassen. Eine Kante ohne gemeinsamen Knoten mit dem Ereignis bleibt exakt
stabil. `runRestStep` lässt seitdem nur noch die Knoten-Aktivierung
abklingen, keine Kanten mehr — Ruhe ist keine feste Zeitspanne, an die
Kanten-Verblassen gekoppelt wäre. In `app.js` wird `applyEventEdgeFade` bei
jeder Weltobjekt-Berührung mit den beteiligten Knoten aufgerufen.

### 2. Vergleichsmodus für zwei gespeicherte Läufe

`compareStoredRuns(dir, runIdA, runIdB)` (`persistence.ts`) lädt zwei zuvor
mit `saveRun` gespeicherte Läufe von der Platte und vergleicht ihre
Graphen über `diffGraphEdges` (`graphDiff.ts`): Kanten nur in A, Kanten nur
in B, und Kanten in beiden mit Stärkenunterschied
(`{ onlyInA, onlyInB, inBoth }`). Läufe sind über `saveRun`/`loadRun`
(bestehende, unveränderte Funktionen) jederzeit wieder ladbar. Ergänzt,
statt ersetzt, das bestehende `compareRuns` in `compare.ts`, das für den
Mehrfach-Kiesel-Vergleich zweier live erzeugter Instanzen gedacht ist.

### 3. Verdichtung des Ereignisprotokolls, ohne Datenverlust

`compactEventLog(log, { id, olderThan, at })` (`eventLog.ts`) fasst alle
Ereignisse mit `time < olderThan` zu einem einzelnen `event_summary`-
Ereignis zusammen, das als Freitext die wichtigsten Fakten trägt: Anzahl
und Zeitraum der zusammengefassten Ereignisse, ihre Ereignistypen und die
beteiligten Objekte. Die Originalereignisse werden dabei **nicht
gelöscht** — sie bekommen nur `compacted: true` und bleiben vollständig im
Log erhalten (über `readEventLog(log, limit, { includeCompacted: true })`
weiterhin lesbar). Ohne die Option liefert `readEventLog` standardmäßig
nur nicht-verdichtete Ereignisse plus die Summaries — genau die Sicht, die
ein LLM-Durchlauf braucht, ohne in einem langen Verlauf zu ertrinken.

### 4. Zeitstempel: sortierte Reihenfolge und Zeitraum-Abfrage

Jedes Ereignis trägt schon beim Schreiben (`appendEvent`) einen
Zeitstempel. `readEventLog` sortiert seine Ausgabe jetzt ausdrücklich nach
Zeit (nicht mehr nur zufällig durch die Schreibreihenfolge richtig). Neu:
`getEventsBetween(log, start, end)` (`eventLog.ts`) liefert alle
nicht-verdichteten Ereignisse in einem Zeitraum `[start, end]`, ebenfalls
zeitlich sortiert — unabhängig davon, in welcher Reihenfolge sie
geschrieben wurden.

### 5. Graph-Export (JSON/GraphML)

`exportGraph(model, format)` und `importGraph(text, format)`
(`graphExport.ts`) exportieren bzw. lesen den aktuellen Graphen in einem
schlanken, austauschbaren Format — unterstützt werden `"json"` und
`"graphml"`. Der Export enthält alle Kanten mit ihrer Stärke und ihren
Herkunftsangaben (welche zwei Knoten sie verbindet). Ein exportierter
Graph ergibt beim Wiedereinlesen denselben Graphen (gleiche Knoten, gleiche
Kanten mit gleicher Stärke). Getrennt von `runSerialization.ts`, das die
vollständige interne Historie für die Wiederherstellung in KieselWesen
selbst sichert — dieser Export ist für den Blick von außen bzw. in anderen
Werkzeugen gedacht.

Alle fünf Punkte sind reine Ergänzungen: Engine-Regeln, Mini-Lerner und
Bestätigungs-Logik sind nur dort verändert, wo ausdrücklich beschrieben
(Punkt 1 betrifft `experimentEngine.ts`, alles andere kommt on top).

## Lizenz

[PolyForm Noncommercial License 1.0.0](LICENSE).
