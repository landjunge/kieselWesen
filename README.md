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

Aktuell existiert der Code-Unterbau: Ereigniskern (append-only Eventlog)
und inneres Datenmodell (Knoten, Verbindungen, Distanz/Nutzung/Aktivierung
getrennt) unter `src/domain/`. Das UI/Design wird separat entwickelt und
ist hier noch nicht eingebunden.

Entwicklertests lokal ausführen:

```sh
npm install
npm run typecheck
npm test
```

## Lizenz

[PolyForm Noncommercial License 1.0.0](LICENSE).
