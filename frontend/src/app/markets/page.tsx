"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api";
import { useFavorites } from "@/context/FavoritesContext";
import MarketCard from "@/component/MarketCard";
import { MarketsPageLoadingSkeleton } from "@/component/loading-route-skeletons";
import { EmptyState } from "@/component/ui/empty-state";
import { Heart, AlertCircle, Inbox } from "lucide-react";

interface Market {
  id: string;
  title: string;
  category: string;
  probability: number;
  totalStaked: number;
  closeAt: string;
  status: string;
}

const CATEGORIES = ["All", "Sports", "Finance", "Crypto", "Politics", "Tech"];

export default function MarketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    favoriteIds,
    toggleFavorite,
    isLoading: favoritesLoading,
  } = useFavorites();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get("category") || "All",
  );
  const [viewMode, setViewMode] = useState<"all" | "favorites">(
    searchParams.get("view") === "favorites" ? "favorites" : "all",
  );

  // Fetch markets
  useEffect(() => {
    const abortController = new AbortController();

    const fetchMarkets = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<Market[]>("/markets", {
          signal: abortController.signal,
        });
        setMarkets(data || []);
      } catch (err) {
        if (err instanceof ApiError) {
          if (
            err.kind !== "network" ||
            err.message !== "Network error: The user aborted a request."
          ) {
            setError(err.message);
          }
        } else if (err instanceof Error && err.name === "AbortError") {
          // Ignore
        } else {
          setError("An unexpected error occurred");
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

  // Update URL when category changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (selectedCategory === "All") {
      params.delete("category");
    } else {
      params.set("category", selectedCategory);
    }
    if (viewMode === "favorites") {
      params.set("view", "favorites");
    } else {
      params.delete("view");
    }
    router.push(`?${params.toString()}`);
  }, [selectedCategory, viewMode, router, searchParams]);

  // Filter markets by category and favorites
  const filteredMarkets = useMemo(() => {
    let filtered = markets;

    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (m) => m.category.toLowerCase() === selectedCategory.toLowerCase(),
      );
    }

    if (viewMode === "favorites") {
      filtered = filtered.filter((m) => favoriteIds.has(m.id));
    }

    return filtered;
  }, [markets, selectedCategory, viewMode, favoriteIds]);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleViewModeChange = useCallback((mode: "all" | "favorites") => {
    setViewMode(mode);
  }, []);

  const handleFavoriteToggle = useCallback(
    (marketId: string) => {
      toggleFavorite(marketId);
    },
    [toggleFavorite],
  );

  const handlePredict = useCallback((marketId: string) => {
    // TODO: Navigate to prediction modal/page
    console.log(`Predict clicked for market ${marketId}`);
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIES.forEach((cat) => {
      if (cat === "All") {
        counts[cat] = markets.length;
      } else {
        counts[cat] = markets.filter(
          (m) => m.category.toLowerCase() === cat.toLowerCase(),
        ).length;
      }
    });
    return counts;
  }, [markets]);

  if (loading || favoritesLoading) return <MarketsPageLoadingSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Markets</h1>
          <p className="mt-2 text-gray-400">
            Browse and predict on various markets
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => handleViewModeChange("all")}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              viewMode === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            All Markets
          </button>
          <button
            onClick={() => handleViewModeChange("favorites")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              viewMode === "favorites"
                ? "bg-primary text-primary-foreground"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            <Heart size={16} />
            Watchlist{" "}
            {viewMode === "favorites" && `(${filteredMarkets.length})`}
          </button>
        </div>

        {/* Category Tabs */}
        {viewMode === "all" && (
          <div className="mb-6 overflow-x-auto pb-2">
            <div className="flex gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? "bg-orange-500 text-white"
                      : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                  aria-pressed={selectedCategory === category}
                >
                  {category} ({categoryCounts[category] || 0})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <div className="flex items-center gap-3 text-red-300">
              <AlertCircle size={20} />
              <div>
                <p className="font-semibold">Error loading markets</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Markets Grid */}
        {filteredMarkets.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                isFavorite={favoriteIds.has(market.id)}
                onFavoriteToggle={() => handleFavoriteToggle(market.id)}
                onPredict={() => handlePredict(market.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={
              viewMode === "favorites" ? (
                <Heart size={32} />
              ) : (
                <Inbox size={32} />
              )
            }
            title={
              viewMode === "favorites"
                ? "No Favorite Markets Yet"
                : selectedCategory === "All"
                  ? "No Markets Available"
                  : `No ${selectedCategory} Markets`
            }
            description={
              viewMode === "favorites"
                ? "Start adding markets to your watchlist to see them here. Click the heart icon on any market to favorite it."
                : `No markets found in this category. Try selecting a different category or check back soon.`
            }
            action={
              viewMode === "favorites"
                ? {
                    label: "Browse Markets",
                    onClick: () => handleViewModeChange("all"),
                  }
                : undefined
            }
            variant="empty"
          />
        )}
      </div>
    </div>
  );
}
