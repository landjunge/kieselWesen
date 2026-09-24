export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PositionChange {
  at: number;
  position: Vec3;
}

export interface ActivationChange {
  at: number;
  activation: number;
}

export interface InnerNode {
  id: string;
  createdAt: number;
  position: Vec3;
  activation: number;
  sourceEventIds: string[];
  positionHistory: PositionChange[];
  activationHistory: ActivationChange[];
}

export interface UsageChange {
  at: number;
  usage: number;
}

export interface StrengthChange {
  at: number;
  strength: number;
}

export interface Edge {
  id: string;
  nodeA: string;
  nodeB: string;
  usage: number;
  strength: number;
  usageHistory: UsageChange[];
  strengthHistory: StrengthChange[];
}

export interface WorldEvent {
  id: string;
  index: number;
  time: number;
  participants: string[];
  payload: unknown;
  resultingChangeIds: string[];
}

export interface InnerModelState {
  nodes: ReadonlyMap<string, InnerNode>;
  edges: ReadonlyMap<string, Edge>;
}

export interface EventLog {
  events: readonly WorldEvent[];
}
