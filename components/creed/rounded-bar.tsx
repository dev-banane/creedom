// Recharts bar shape with a top radius proportional to the bar's own width
// (capped), so corners keep a consistent look whether the bar is wide or thin
// and never collapse into a slim pill. Use on the topmost segment of a stack.
export function RoundedTopBar({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  if (height <= 0 || width <= 0) return <g />;
  const r = Math.min(width * 0.5, height, 10);
  const d = `M${x},${y + height}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${y + r}V${y + height}Z`;
  return <path d={d} fill={fill} />;
}
