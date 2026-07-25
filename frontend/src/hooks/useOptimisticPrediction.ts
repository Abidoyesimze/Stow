import { useCallback, useState } from "react";
import { useToast } from "./useToast";

export interface OptimisticPredictionState {
    id: string;
    marketId: string;
    amount: number;
    direction: "yes" | "no";
    status: "pending" | "confirmed" | "failed";
    error?: string;
}

interface UseOptimisticPredictionOptions {
    onSubmit: (prediction: Omit<OptimisticPredictionState, "id" | "status" | "error">) => Promise<{ id: string }>;
}

export function useOptimisticPrediction({
    onSubmit,
}: UseOptimisticPredictionOptions) {
    const [predictions, setPredictions] = useState<OptimisticPredictionState[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    const addOptimisticPrediction = useCallback(
        async (marketId: string, amount: number, direction: "yes" | "no") => {
            const tempId = `temp_${Date.now()}_${Math.random()}`;

            // Add optimistic prediction
            setPredictions((prev) => [
                ...prev,
                {
                    id: tempId,
                    marketId,
                    amount,
                    direction,
                    status: "pending",
                },
            ]);

            setIsSubmitting(true);

            try {
                const result = await onSubmit({ marketId, amount, direction });

                // Reconcile with server response
                setPredictions((prev) =>
                    prev.map((p) =>
                        p.id === tempId
                            ? { ...p, id: result.id, status: "confirmed" }
                            : p
                    )
                );

                toast.success("Prediction placed successfully");
                return result.id;
            } catch (error) {
                // Rollback on failure
                setPredictions((prev) =>
                    prev.map((p) =>
                        p.id === tempId
                            ? {
                                ...p,
                                status: "failed",
                                error: error instanceof Error ? error.message : "Failed to place prediction",
                            }
                            : p
                    )
                );

                toast.error(
                    error instanceof Error ? error.message : "Failed to place prediction"
                );

                // Remove failed prediction after a delay
                setTimeout(() => {
                    setPredictions((prev) => prev.filter((p) => p.id !== tempId));
                }, 3000);

                throw error;
            } finally {
                setIsSubmitting(false);
            }
        },
        [onSubmit, toast]
    );

    const removePrediction = useCallback((id: string) => {
        setPredictions((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return {
        predictions,
        addOptimisticPrediction,
        removePrediction,
        isSubmitting,
    };
}
