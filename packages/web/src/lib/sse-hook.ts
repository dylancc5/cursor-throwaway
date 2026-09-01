'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentWorkerState,
  BurnConfig,
  BurnEvent,
  BurnSnapshot,
} from '@cursor-burner/shared';
import { apiClient } from '@/lib/api-client';
import { MockBurnEngine } from '@/lib/mock-engine';

export interface UseBurnEventsOptions {
  sessionId?: string;
  isMock?: boolean;
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface BurnEventWithId {
  id: string;
  event: BurnEvent;
}

function eventTimestamp(event: BurnEvent): string {
  if ('at' in event && typeof event.at === 'string') {
    return event.at;
  }
  return new Date().toISOString();
}

export function useBurnEvents(options: UseBurnEventsOptions = {}) {
  const { sessionId, isMock = false } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [events, setEvents] = useState<BurnEventWithId[]>([]);
  const [snapshot, setSnapshot] = useState<BurnSnapshot | null>(null);
  const [agents, setAgents] = useState<Map<number, AgentWorkerState>>(new Map());
  const [burnRateHistory, setBurnRateHistory] = useState<
    Array<{ time: string; rate: number; tokens: number }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const mockEngineRef = useRef<MockBurnEngine | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const pushEvent = useCallback((event: BurnEvent) => {
    const eventWithId: BurnEventWithId = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      event,
    };

    setEvents((prev) => [eventWithId, ...prev.slice(0, 199)]);

    if (event.type === 'usage.snapshot') {
      const at = event.at;
      setSnapshot({
        sessionId: event.sessionId || sessionId || 'current',
        status: 'burning',
        session: event.session,
        account: event.account,
        cap: event.cap,
        activeAgents: event.activeAgents,
        targetConcurrency: 20,
        at,
      });

      setBurnRateHistory((prev) => {
        const next = [
          ...prev,
          {
            time: new Date(at).toLocaleTimeString('en-US', { hour12: false }),
            rate: event.session.tokensPerSec,
            tokens: event.session.tokens,
          },
        ];
        return next.slice(-40);
      });
    } else if (event.type === 'agent.spawned') {
      setAgents((prev) => {
        const next = new Map(prev);
        next.set(event.workerId, {
          workerId: event.workerId,
          agentId: event.agentId,
          status: 'spawning',
          model: event.model || 'composer-2.5',
          turnsCompleted: 0,
          totalTokens: 0,
          lastActiveAt: event.at,
        });
        return next;
      });
    } else if (event.type === 'run.started' && event.workerId !== undefined) {
      setAgents((prev) => {
        const next = new Map(prev);
        const current = next.get(event.workerId!);
        if (current) {
          next.set(event.workerId!, {
            ...current,
            status: 'working',
            model: event.model || current.model,
            currentRunId: event.runId,
            lastActiveAt: event.at,
          });
        }
        return next;
      });
    } else if (event.type === 'run.completed' && event.workerId !== undefined) {
      setAgents((prev) => {
        const next = new Map(prev);
        const current = next.get(event.workerId!);
        if (current) {
          next.set(event.workerId!, {
            ...current,
            status: 'working',
            turnsCompleted: current.turnsCompleted + 1,
            totalTokens: current.totalTokens + event.usage.totalTokens,
            lastActiveAt: event.at,
          });
        }
        return next;
      });
    } else if (event.type === 'agent.recycled' && event.workerId !== undefined) {
      setAgents((prev) => {
        const next = new Map(prev);
        const current = next.get(event.workerId!);
        if (current) {
          next.set(event.workerId!, {
            ...current,
            status: 'recycled',
            turnsCompleted: event.turnsCompleted,
            lastActiveAt: event.at,
          });
        }
        return next;
      });
    } else if (event.type === 'session.stopped') {
      setSnapshot((prev) => (prev ? { ...prev, status: 'stopped' } : null));
    } else if (event.type === 'session.paused') {
      setSnapshot((prev) => (prev ? { ...prev, status: 'paused' } : null));
    } else if (event.type === 'session.resumed') {
      setSnapshot((prev) => (prev ? { ...prev, status: 'burning' } : null));
    } else if (event.type === 'error') {
      setError(event.message);
    }
  }, [sessionId]);

  const connect = useCallback(() => {
    if (isMock) {
      setConnectionState('connected');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionState('connecting');
    const es = new EventSource(apiClient.getEventsUrl(), { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionState('connected');
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    const handlePayload = (e: MessageEvent) => {
      try {
        const payload: BurnEvent = JSON.parse(e.data);
        pushEvent(payload);
      } catch (err) {
        console.error('[useBurnEvents] Failed to parse SSE event:', err);
      }
    };

    es.addEventListener('burn', handlePayload);
    es.onmessage = handlePayload;

    es.onerror = () => {
      setConnectionState('error');
      es.close();

      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * 2 ** attempts, 15000);
      reconnectAttemptsRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [isMock, pushEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (mockEngineRef.current) {
        mockEngineRef.current.stop('user');
      }
    };
  }, [connect]);

  const startBurn = useCallback(
    async (config: BurnConfig) => {
      setError(null);
      if (isMock) {
        if (mockEngineRef.current) {
          mockEngineRef.current.stop();
        }
        mockEngineRef.current = new MockBurnEngine({
          config,
          onEvent: (e) => pushEvent(e),
        });
        mockEngineRef.current.start();
        return;
      }

      try {
        await apiClient.startBurn(config);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start burn';
        setError(message);
        throw err;
      }
    },
    [isMock, pushEvent],
  );

  const stopBurn = useCallback(async () => {
    if (isMock) {
      mockEngineRef.current?.stop('user');
      return;
    }

    try {
      await apiClient.stopBurn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop burn';
      setError(message);
      throw err;
    }
  }, [isMock]);

  const pauseBurn = useCallback(async () => {
    if (isMock) {
      mockEngineRef.current?.pause();
      return;
    }

    try {
      await apiClient.pauseBurn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause burn';
      setError(message);
      throw err;
    }
  }, [isMock]);

  const resumeBurn = useCallback(async () => {
    if (isMock) {
      mockEngineRef.current?.resume();
      return;
    }

    try {
      await apiClient.resumeBurn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume burn';
      setError(message);
      throw err;
    }
  }, [isMock]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    connectionState,
    events,
    snapshot,
    agents: Array.from(agents.values()),
    burnRateHistory,
    error,
    startBurn,
    stopBurn,
    pauseBurn,
    resumeBurn,
    clearEvents,
  };
}
