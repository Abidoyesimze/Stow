"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useWallet } from "./WalletContext";

export interface FavoritesContextValue {
  favoriteIds: Set<string>;
  isFavorite: (marketId: string) => boolean;
  toggleFavorite: (marketId: string) => void;
  addFavorite: (marketId: string) => void;
  removeFavorite: (marketId: string) => void;
  isLoading: boolean;
}

const DEFAULT_CONTEXT_VALUE: FavoritesContextValue = {
  favoriteIds: new Set(),
  isFavorite: () => false,
  toggleFavorite: () => {},
  addFavorite: () => {},
  removeFavorite: () => {},
  isLoading: false,
};

const FavoritesContext = createContext<FavoritesContextValue>(
  DEFAULT_CONTEXT_VALUE,
);

const STORAGE_KEY_PREFIX = "insightarena.favorites";

function getStorageKey(address: string | null): string {
  if (!address) return `${STORAGE_KEY_PREFIX}.guest`;
  return `${STORAGE_KEY_PREFIX}.${address}`;
}

function readStoredFavorites(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[] | null;
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeStoredFavorites(key: string, favorites: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(favorites)));
  } catch {
    // Storage unavailable/full — persistence is best-effort.
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = getStorageKey(address);

  // Load favorites from localStorage on mount and when address changes
  useEffect(() => {
    setIsLoading(true);
    const stored = readStoredFavorites(storageKey);
    setFavoriteIds(stored);
    setIsLoading(false);
  }, [storageKey]);

  const isFavorite = useCallback(
    (marketId: string) => favoriteIds.has(marketId),
    [favoriteIds],
  );

  const addFavorite = useCallback(
    (marketId: string) => {
      setFavoriteIds((prev) => {
        const updated = new Set(prev);
        updated.add(marketId);
        writeStoredFavorites(storageKey, updated);
        return updated;
      });
    },
    [storageKey],
  );

  const removeFavorite = useCallback(
    (marketId: string) => {
      setFavoriteIds((prev) => {
        const updated = new Set(prev);
        updated.delete(marketId);
        writeStoredFavorites(storageKey, updated);
        return updated;
      });
    },
    [storageKey],
  );

  const toggleFavorite = useCallback(
    (marketId: string) => {
      setFavoriteIds((prev) => {
        const updated = new Set(prev);
        if (updated.has(marketId)) {
          updated.delete(marketId);
        } else {
          updated.add(marketId);
        }
        writeStoredFavorites(storageKey, updated);
        return updated;
      });
    },
    [storageKey],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteIds,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      isLoading,
    }),
    [
      favoriteIds,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      isLoading,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return context;
}
