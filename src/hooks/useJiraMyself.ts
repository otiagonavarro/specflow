import { useState, useEffect } from 'react';
import { isJiraConfigured } from '../api/config';
import { fetchJiraMyself, type JiraMyself } from '../api/jira';

export function useJiraMyself(): { loading: boolean; user: JiraMyself | null } {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<JiraMyself | null>(null);

  useEffect(() => {
    if (!isJiraConfigured()) {
      setLoading(false);
      setUser(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchJiraMyself()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, user };
}
