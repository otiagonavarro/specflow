import { useState, useEffect, useCallback } from 'react';
import { getConfig, isJiraConfigured } from '../api/config';
import { fetchBoardScopeJql } from '../api/jira';

export interface UseDefaultBoardScopeResult {
  ready: boolean;
  baseJql: string | null;
  error: string | null;
  refetch: () => void;
}

export function useDefaultBoardScopeJql(projectKey: string): UseDefaultBoardScopeResult {
  const boardId = getConfig().jira?.boardId?.trim() ?? '';
  const pk = projectKey.trim();

  const [ready, setReady] = useState(!boardId);
  const [baseJql, setBaseJql] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!boardId || !isJiraConfigured()) {
      setReady(true);
      setBaseJql(null);
      setError(null);
      return;
    }

    if (!pk) {
      setReady(true);
      setBaseJql(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setReady(false);
    setError(null);
    setBaseJql(null);

    fetchBoardScopeJql(boardId, pk)
      .then((r) => {
        if (!cancelled) {
          setBaseJql(r.jql);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setBaseJql(null);
          setError(e instanceof Error ? e.message : 'Board scope failed');
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [boardId, pk, tick]);

  return { ready, baseJql, error, refetch };
}
