"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "insightarena.onboarding.v1";

export interface TourStep {
  id: string;
  /** CSS selector or element id of the element to highlight. */
  target: string;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: TourStep[] = [
  {
    id: "connect-wallet",
    target: "[data-tour='connect-wallet']",
    title: "Connect your wallet",
    description:
      "Start by connecting your Stellar wallet via Freighter. This lets you place predictions and earn rewards.",
  },
  {
    id: "explore-markets",
    target: "[data-tour='markets-nav']",
    title: "Explore markets",
    description:
      "Browse active prediction markets across sports, crypto, and current events. Each market closes when the event resolves.",
  },
  {
    id: "place-prediction",
    target: "[data-tour='place-prediction']",
    title: "Place a prediction",
    description:
      "Choose YES or NO, enter an amount, and submit. Your prediction is recorded on-chain — no middleman.",
  },
  {
    id: "track-rewards",
    target: "[data-tour='rewards-nav']",
    title: "Track your rewards",
    description:
      "Correct predictions earn you rewards. Head to the Rewards page to claim what you've won.",
  },
];

interface TourState {
  completed: boolean;
  dismissed: boolean;
}

function readState(): TourState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: false, dismissed: false };
    return JSON.parse(raw) as TourState;
  } catch {
    return { completed: false, dismissed: false };
  }
}

function writeState(state: TourState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — silently ignore
  }
}

export interface UseOnboardingTourResult {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
}

/**
 * Manages the new-user onboarding tour.
 *
 * Automatically starts for first-time visitors. Persists completion/dismissal
 * to localStorage so the tour never reappears unless re-launched via `start()`.
 * Keyboard-accessible: consumers should wire `next` to Enter/ArrowRight and
 * `prev` to ArrowLeft, and `skip` to Escape.
 */
export function useOnboardingTour(): UseOnboardingTourResult {
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Auto-start for new users after hydration
  useEffect(() => {
    const state = readState();
    if (!state.completed && !state.dismissed) {
      setIsActive(true);
    }
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setIsActive(true);
  }, []);

  const skip = useCallback(() => {
    setIsActive(false);
    writeState({ completed: false, dismissed: true });
  }, []);

  const complete = useCallback(() => {
    setIsActive(false);
    writeState({ completed: true, dismissed: false });
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      const next = i + 1;
      if (next >= ONBOARDING_STEPS.length) {
        complete();
        return i;
      }
      return next;
    });
  }, [complete]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const currentStep = isActive ? (ONBOARDING_STEPS[stepIndex] ?? null) : null;

  return {
    isActive,
    currentStepIndex: stepIndex,
    currentStep,
    totalSteps: ONBOARDING_STEPS.length,
    start,
    next,
    prev,
    skip,
    complete,
    canGoBack: stepIndex > 0,
    canGoNext: stepIndex < ONBOARDING_STEPS.length - 1,
    isLastStep: stepIndex === ONBOARDING_STEPS.length - 1,
  };
}
