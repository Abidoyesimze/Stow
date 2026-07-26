import { useState, useEffect } from 'react';

export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalSeconds: number;
}

/**
 * Hook to calculate countdown time from a target date.
 * Avoids unnecessary re-renders by only updating when the time actually changes.
 * Returns isExpired=true when target date has passed.
 */
export function useCountdown(targetDate: string | Date | number): CountdownTime {
  const [time, setTime] = useState<CountdownTime>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    totalSeconds: 0,
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now();
      const target = typeof targetDate === 'string' ? new Date(targetDate).getTime() : typeof targetDate === 'number' ? targetDate : targetDate.getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTime({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          totalSeconds: 0,
        });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTime({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
        totalSeconds: Math.floor(diff / 1000),
      });
    };

    calculateTime();

    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return time;
}

/**
 * Format countdown time to a display string.
 * If expired, returns "Event Started" or "Event Locked".
 */
export function formatCountdown(time: CountdownTime, expired?: string): string {
  if (time.isExpired) {
    return expired || 'Event Started';
  }

  if (time.days > 0) {
    return `${time.days}d ${time.hours}h`;
  }

  if (time.hours > 0) {
    return `${time.hours}h ${time.minutes}m`;
  }

  if (time.minutes > 0) {
    return `${time.minutes}m ${time.seconds}s`;
  }

  return `${time.seconds}s`;
}
