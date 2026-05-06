import { cn, scoreColor } from "@/lib/utils";

interface Props {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

export default function SEOScoreRing({ score, size = 80, label = "SEO Score", className }: Props) {
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={color}
          fontSize={size * 0.2} fontWeight="bold" transform={`rotate(90, ${size / 2}, ${size / 2})`}>
          {score}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
