import { useEffect, useState } from 'react';
import { fetchBoardColumns, type JiraBoardColumn } from '../api/jira';

export function useBoardColumns(boardId: string | undefined) {
  const [columns, setColumns] = useState<JiraBoardColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = boardId?.trim();
    if (!id) {
      setColumns([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchBoardColumns(id)
      .then((c) => {
        if (!cancelled) {
          setColumns(c);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setColumns([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  return { columns, loading, error };
}
