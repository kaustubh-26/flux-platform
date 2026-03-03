type SparklinePoint = {
  price: number;
  at: number;
};

type SparklineProps = {
  points: SparklinePoint[];
  className?: string;
  width?: number;
  height?: number;
};

export function Sparkline({
  points,
  className = '',
  width = 70,
  height = 20,
}: SparklineProps) {
  if (!points || points.length < 2) {
    return (
      <span className={`text-xs text-slate-500 ${className}`}>
        —
      </span>
    );
  }

  const values = points.map(p => p.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const polyline = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p.price - min) / span) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const trend = values[values.length - 1] - values[0];
  const colorClass =
    trend > 0
      ? 'text-emerald-400'
      : trend < 0
        ? 'text-rose-400'
        : 'text-slate-400';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-[70px] h-5 ${colorClass} ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={polyline}
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        fill="none"
      />
    </svg>
  );
}
