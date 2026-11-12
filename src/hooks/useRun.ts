'use client';

import { useState, useEffect, useRef } from 'react';
import type { Report } from '@/lib/contracts/report';
import type { VerificationEvent } from '@/lib/contracts/events';

export type ConnectionState = 'connecting' | 'connected' | 'polling' | 'disconnected';

export interface UseRunResult {
  runSnapshot: Report | null;
  events: VerificationEvent[];
  connectionState: ConnectionState;
}

export function useRun(runId: string): UseRunResult {
  const [runSnapshot, setRunSnapshot] = useState<Report | null>(null);
  const [events, setEvents] = useState<VerificationEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [latestSeq, setLatestSeq] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestSeqRef = useRef<number>(latestSeq);

  latestSeqRef.current = latestSeq;

  useEffect(() => {
    if (!runId) return;

    let isSubscribed = true;

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      if (!isSubscribed) return;
      setConnectionState('polling');

      const fetchSnapshot = async () => {
        try {
          const res = await fetch(`/api/runs/${runId}`);
          if (!res.ok) return;
          const data = await res.json();
          if (!isSubscribed) return;

          const snapshot = data.report || data;
          if (snapshot && typeof snapshot === 'object' && 'reportId' in snapshot) {
            setRunSnapshot(snapshot as Report);
            if (snapshot.status && snapshot.status !== 'running') {
              stopPolling();
              setConnectionState('disconnected');
            }
          }
        } catch {
          // Soft retry on next interval
        }
      };

      fetchSnapshot();
      pollIntervalRef.current = setInterval(fetchSnapshot, 2000);
    };

    const connectSSE = () => {
      setConnectionState('connecting');
      const url = `/api/runs/${runId}/events?afterSeq=${latestSeqRef.current}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isSubscribed) return;
        setConnectionState('connected');
        stopPolling();
      };

      es.onmessage = (messageEvent) => {
        if (!isSubscribed) return;
        try {
          const parsed = JSON.parse(messageEvent.data);

          if (parsed && typeof parsed === 'object') {
            if ('seq' in parsed && typeof parsed.seq === 'number') {
              setLatestSeq(parsed.seq);
              setEvents((prev) => [...prev, parsed as VerificationEvent]);
            }

            if ('reportId' in parsed) {
              setRunSnapshot(parsed as Report);
            } else if (parsed.type === 'run_finished' && parsed.report) {
              setRunSnapshot(parsed.report as Report);
              es.close();
              setConnectionState('disconnected');
            }
          }
        } catch {
          // Ignore unparseable frames
        }
      };

      es.onerror = () => {
        if (!isSubscribed) return;
        es.close();
        eventSourceRef.current = null;
        startPolling();
      };
    };

    connectSSE();

    return () => {
      isSubscribed = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
    };
  }, [runId]);

  return {
    runSnapshot,
    events,
    connectionState,
  };
}
