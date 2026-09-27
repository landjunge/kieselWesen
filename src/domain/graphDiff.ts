import type { InnerModelState } from "./types.js";

/**
 * Vergleichsmodus für zwei (typischerweise gespeicherte, wieder geladene)
 * Graphen: reine Fakten über Kanten — keine Interpretation. Ergänzt
 * compareRuns (compare.ts), das für den Mehrfach-Kiesel-Vergleich zweier
 * live erzeugter Instanzen gedacht ist; diese Funktion hier klassifiziert
 * stattdessen explizit "nur in A", "nur in B" und "in beiden, mit
 * Stärkenunterschied" — die von Punkt 2 geforderte Form.
 */

export interface EdgeSummary {
  edgeKey: string;
  nodeA: string;
  nodeB: string;
  strength: number;
}

export interface SharedEdgeDiff {
  edgeKey: string;
  nodeA: string;
  nodeB: string;
  strengthA: number;
  strengthB: number;
  strengthDelta: number;
}

export interface GraphEdgeDiff {
  onlyInA: EdgeSummary[];
  onlyInB: EdgeSummary[];
  inBoth: SharedEdgeDiff[];
}

/**
 * Vergleicht die Kanten zweier Graphen rein faktisch: welche Kante gibt es
 * nur im einen, nur im anderen, oder in beiden (mit Stärkenunterschied).
 * Reine Funktion, unabhängig davon, ob die Graphen aus einem laufenden
 * Zustand oder aus zwei geladenen, gespeicherten Läufen stammen.
 */
export function diffGraphEdges(a: InnerModelState, b: InnerModelState): GraphEdgeDiff {
  const onlyInA: EdgeSummary[] = [];
  const onlyInB: EdgeSummary[] = [];
  const inBoth: SharedEdgeDiff[] = [];

  const edgeKeys = new Set([...a.edges.keys(), ...b.edges.keys()]);
  for (const edgeKey of edgeKeys) {
    const edgeA = a.edges.get(edgeKey);
    const edgeB = b.edges.get(edgeKey);
    if (edgeA && !edgeB) {
      onlyInA.push({ edgeKey, nodeA: edgeA.nodeA, nodeB: edgeA.nodeB, strength: edgeA.strength });
    } else if (edgeB && !edgeA) {
      onlyInB.push({ edgeKey, nodeA: edgeB.nodeA, nodeB: edgeB.nodeB, strength: edgeB.strength });
    } else if (edgeA && edgeB) {
      inBoth.push({
        edgeKey,
        nodeA: edgeA.nodeA,
        nodeB: edgeA.nodeB,
        strengthA: edgeA.strength,
        strengthB: edgeB.strength,
        strengthDelta: edgeB.strength - edgeA.strength,
      });
    }
  }

  return { onlyInA, onlyInB, inBoth };
}
