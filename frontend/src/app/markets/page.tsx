'use client';

import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';

// Assuming a Market type exists, adjust according to your actual types
interface Market {
  id: string;
  name: string;
  // ...other properties
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchMarkets = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<Market[]>('/markets', {
          signal: abortController.signal,
        });
        setMarkets(data);
      } catch (err) {
        if (err instanceof ApiError) {
          // Ignore abort errors silently
          if (err.kind !== 'network' || err.message !== 'Network error: The user aborted a request.') {
             setError(err.message);
          }
        } else if (err instanceof Error && err.name === 'AbortError') {
          // Native fetch AbortError fallback
          // Ignore
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchMarkets();

    return () => {
      abortController.abort();
    };
  }, []);

  if (loading) return <div>Loading markets...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Markets</h1>
      <ul>
        {markets.map((market) => (
          <li key={market.id}>{market.name}</li>
        ))}
      </ul>
    </div>
  );
}