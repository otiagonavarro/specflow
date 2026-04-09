import { useState, useEffect, useCallback, useRef } from 'react';
import type { Issue } from '../api/types';
import type { IssuesJqlPageResult } from '../api/jira';
import { fetchIssuesPage, jqlDefaultProjectIssues, DEFAULT_JQL_PAGE_SIZE } from '../api/jira';
import { isJiraConfigured } from '../api/config';

export interface UseIssuesResult {
  issues: Issue[];
  allLoadedIssues: Issue[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  needsConfig: boolean;
  refetch: () => void;
  pageIndex: number;
  pageCount: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  goPrevPage: () => void;
  goNextPage: () => void;
}

export function useJiraJqlPages(jql: string | null, pageSize = DEFAULT_JQL_PAGE_SIZE): UseIssuesResult {
  const [pages, setPages] = useState<IssuesJqlPageResult[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [tick, setTick] = useState(0);

  const pagesRef = useRef(pages);
  const pageIndexRef = useRef(pageIndex);
  pagesRef.current = pages;
  pageIndexRef.current = pageIndex;

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const query = jql?.trim() ?? '';
    if (!isJiraConfigured() || !query) {
      setPages([]);
      setPageIndex(0);
      setNeedsConfig(!isJiraConfigured() || !query);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      return;
    }

    setNeedsConfig(false);
    let cancelled = false;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setPageIndex(0);
    setPages([]);

    fetchIssuesPage(query, { maxResults: pageSize })
      .then((first) => {
        if (cancelled) return;
        setPages([first]);
        setPageIndex(0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load issues from Jira');
        setPages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jql, tick, pageSize]);

  const allLoadedIssues = pages.flatMap((p) => p.issues);
  const safeIndex = pages.length === 0 ? 0 : Math.min(pageIndex, pages.length - 1);
  const issues = pages[safeIndex]?.issues ?? [];

  const lastPage = pages[pages.length - 1];
  const hasMoreFromServer = !!lastPage && lastPage.isLast === false && !!lastPage.nextPageToken;
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < pages.length - 1 || hasMoreFromServer;

  const goPrevPage = useCallback(() => {
    setPageIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNextPage = useCallback(() => {
    const prevPages = pagesRef.current;
    if (prevPages.length === 0) return;
    const idx = Math.min(pageIndexRef.current, prevPages.length - 1);

    if (idx < prevPages.length - 1) {
      setPageIndex(idx + 1);
      return;
    }

    const last = prevPages[prevPages.length - 1];
    if (!last || last.isLast || !last.nextPageToken) return;

    const query = jql?.trim() ?? '';
    if (!query) return;

    setLoadingMore(true);
    fetchIssuesPage(query, { maxResults: pageSize, nextPageToken: last.nextPageToken })
      .then((next) => {
        setPages((p) => [...p, next]);
        setPageIndex((i) => i + 1);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load next page');
      })
      .finally(() => setLoadingMore(false));
  }, [jql, pageSize]);

  return {
    issues,
    allLoadedIssues,
    loading,
    loadingMore,
    error,
    needsConfig,
    refetch,
    pageIndex: safeIndex,
    pageCount: pages.length,
    canGoPrev,
    canGoNext,
    goPrevPage,
    goNextPage,
  };
}

export function useIssues(jql?: string, pageSize = DEFAULT_JQL_PAGE_SIZE): UseIssuesResult {
  const fallback = jqlDefaultProjectIssues();
  const explicit = jql?.trim();
  const effectiveJql = explicit || fallback || null;
  return useJiraJqlPages(effectiveJql, pageSize);
}
