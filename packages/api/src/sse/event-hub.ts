import type { BurnEvent } from "@cursor-burner/shared";

export type SseWriter = (event: BurnEvent) => void;

export class EventHub {
  private readonly subscribers = new Map<string, Set<SseWriter>>();

  subscribe(sessionId: string, writer: SseWriter): () => void {
    let set = this.subscribers.get(sessionId);
    if (!set) {
      set = new Set();
      this.subscribers.set(sessionId, set);
    }
    set.add(writer);
    return () => {
      set?.delete(writer);
      if (set && set.size === 0) {
        this.subscribers.delete(sessionId);
      }
    };
  }

  publish(sessionId: string, event: BurnEvent): void {
    const set = this.subscribers.get(sessionId);
    if (!set) return;
    for (const writer of set) {
      writer(event);
    }
  }

  hasSubscribers(sessionId: string): boolean {
    return (this.subscribers.get(sessionId)?.size ?? 0) > 0;
  }
}
