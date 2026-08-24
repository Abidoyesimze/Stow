type ProgressRingProps = {
  percentage: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
};

export default function ProgressRing({
  percentage,
  label = "Goal progress",
  size = 96,
  strokeWidth = 8,
}: ProgressRingProps) {
  const progress = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      aria-label={`${label}: ${progress}%`}
      className="block"
      data-testid="progress-ring"
      data-progress={progress}
      height={size}
      role="img"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
    >
      <circle
        className="stroke-border"
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        strokeWidth={strokeWidth}
      />
      <circle
        className="origin-center -rotate-90 stroke-brand transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
      <text
        className="fill-foreground text-sm font-semibold"
        dominantBaseline="middle"
        textAnchor="middle"
        x="50%"
        y="50%"
      >
        {Math.round(progress)}%
      </text>
    </svg>
  );
}