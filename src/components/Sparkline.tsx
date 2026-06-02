import type { Point } from "@/lib/demo-series";

type Props = {
  past: Point[];
  forecast?: Point[];
  width?: number;
  height?: number;
  stroke?: string;
  // 부드러운 곡선
  smooth?: boolean;
  // 가격축 라벨 표시
  showAxis?: boolean;
};

// 외부 의존성 없는 SVG 라인 차트.
// 과거는 실선, 예측은 파선. 좌표는 viewBox 기반 — width/height는 표시 단위.
export function Sparkline({
  past,
  forecast = [],
  width = 320,
  height = 80,
  stroke = "#a3e635",
  smooth = false,
  showAxis = false,
}: Props) {
  if (past.length < 2) return null;

  const padX = showAxis ? 32 : 2;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const all = [...past, ...forecast];
  const values = all.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // x 좌표는 인덱스 균등 — 일자별 갭은 무시(시계열 시각화엔 충분)
  const xAt = (i: number) => padX + (i / (all.length - 1)) * innerW;
  const yAt = (v: number) =>
    padY + innerH - ((v - min) / range) * innerH;

  const pastPath = buildPath(past.map((p, i) => [xAt(i), yAt(p.value)]), smooth);
  const fcOffset = past.length - 1;
  const fcPoints: [number, number][] = forecast.length
    ? [
        [xAt(fcOffset), yAt(past[fcOffset].value)],
        ...forecast.map((p, i): [number, number] => [
          xAt(fcOffset + 1 + i),
          yAt(p.value),
        ]),
      ]
    : [];
  const forecastPath = fcPoints.length ? buildPath(fcPoints, smooth) : "";

  // 현재 시점 마커
  const cx = xAt(fcOffset);
  const cy = yAt(past[past.length - 1].value);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="시세 차트"
    >
      {showAxis && (
        <>
          <text
            x={padX - 4}
            y={padY + 10}
            textAnchor="end"
            fontSize="9"
            fill="#71717a"
          >
            {fmt(max)}
          </text>
          <text
            x={padX - 4}
            y={height - padY}
            textAnchor="end"
            fontSize="9"
            fill="#71717a"
          >
            {fmt(min)}
          </text>
        </>
      )}

      {/* 과거 영역 — 매우 옅은 fill */}
      <path
        d={`${pastPath} L ${xAt(past.length - 1)} ${height - padY} L ${xAt(0)} ${height - padY} Z`}
        fill={stroke}
        opacity="0.07"
      />

      {/* 과거 라인 */}
      <path
        d={pastPath}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* 예측 라인 (파선) */}
      {forecastPath && (
        <path
          d={forecastPath}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* 현재 시점 마커 */}
      <circle cx={cx} cy={cy} r="2.5" fill={stroke} />
    </svg>
  );
}

function buildPath(points: [number, number][], smooth: boolean): string {
  if (points.length === 0) return "";
  if (!smooth || points.length < 3) {
    return points
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(" ");
  }
  // Catmull-Rom → Bezier 스무딩
  const parts: string[] = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    parts.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`);
  }
  return parts.join(" ");
}

function fmt(v: number): string {
  if (v >= 10000) return Math.round(v).toLocaleString();
  if (v >= 1000) return Math.round(v).toLocaleString();
  return (Math.round(v * 10) / 10).toString();
}
