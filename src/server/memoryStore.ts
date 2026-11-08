import type { EventKind, NodeRow, ServerStore } from './handler';

/** In-memory ServerStore: used by tests and by the offline "pretend server" for demos. */
export class MemoryStore implements ServerStore {
  nodes = new Map<string, NodeRow>();
  events: Array<{ nodeId: string; userId: string; kind: EventKind; at: number }> = [];
  banned = new Set<string>();
  private n = 0;
  newId() { return `n${(++this.n).toString(36).padStart(5, '0')}`; }
  async getNode(id: string) { return this.nodes.get(id) ?? null; }
  async insertNode(row: NodeRow) { this.nodes.set(row.id, row); }
  async countNodesSince(playerId: string, since: number) { return [...this.nodes.values()].filter((r) => r.playerId === playerId && r.createdAt >= since).length; }
  async addEvent(e: { nodeId: string; userId: string; kind: EventKind; at: number }) { this.events.push(e); }
  async listNodesBy(playerId: string, limit: number) { return [...this.nodes.values()].filter((r) => r.playerId === playerId).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit); }
  async isBanned(id: string) { return this.banned.has(id); }
}
