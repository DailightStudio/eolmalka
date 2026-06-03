import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import type { Point } from "@/lib/demo-series";

type Props = {
  past: Point[];
  forecast?: Point[];
  // 신뢰구간(±1σ) — forecast와 같은 길이
  forecastBand?: { upper: number[]; lower: number[] };
  width?: number;
  height?: number;
  stroke?: string;
  smooth?: boolean;
};

// react-native-svg 기반 라인 차트. 과거 실선 + 예측 파선 + 신뢰구간 영역 + 현재 시점 마커.
export function Sparkline({
  past,
  forecast = [],
  forecastBand,
  width = 320,
  height = 80,
  stroke = "#a3e635",
  smooth = false,
}: Props) {
  if (past.length < 2) return null;

  const padX = 2;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const all = [...past, ...forecast];
  const bandValues = forecastBand
    ? [...forecastBand.upper, ...forecastBand.lower]
    : [];
  const values = [...all.map((p) => p.value), ...bandValues];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xAt = (i: number) => padX + (i / (all.length - 1)) * innerW;
  const yAt = (v: number) => padY + innerH - ((v - min) / range) * innerH;

  const pastPath = buildPath(
    past.map((p, i) => [xAt(i), yAt(p.value)]),
    smooth,
  );
  const fcOffset = past.length - 1;
  const fcPoints: Array<[number, number]> = forecast.length
    ? [
        [xAt(fcOffset), yAt(past[fcOffset].value)],
        ...forecast.map(
          (p, i): [number, number] => [xAt(fcOffset + 1 + i), yAt(p.value)],
        ),
      ]
    : [];
  const forecastPath = fcPoints.length ? buildPath(fcPoints, smooth) : "";

  const cx = xAt(fcOffset);
  const cy = yAt(past[past.length - 1].value);

  // 신뢰구간 영역 (upper → lower 닫힌 polygon)
  let bandPath = "";
  if (forecastBand && forecast.length > 0) {
    const upperPts: Array<[number, number]> = forecastBand.upper.map((v, i) => [
      xAt(fcOffset + 1 + i),
      yAt(v),
    ]);
    const lowerPts: Array<[number, number]> = forecastBand.lower
      .map((v, i): [number, number] => [xAt(fcOffset + 1 + i), yAt(v)])
      .reverse();
    // 시작점은 현재가
    const startX = xAt(fcOffset);
    const startY = yAt(past[past.length - 1].value);
    const pts = [[startX, startY], ...upperPts, ...lowerPts, [startX, startY]];
    bandPath = pts
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(" ") + " Z";
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bandPath ? (
        <Path d={bandPath} fill={stroke} opacity={0.13} stroke="none" />
      ) : null}
      <Path d={pastPath} fill="none" stroke={stroke} strokeWidth={1.5} />
      {forecastPath ? (
        <Path
          d={forecastPath}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.7}
        />
      ) : null}
      <Circle cx={cx} cy={cy} r={2.5} fill={stroke} />
    </Svg>
  );
}

function buildPath(points: Array<[number, number]>, smooth: boolean): string {
  if (points.length === 0) return "";
  if (!smooth || points.length < 3) {
    return points
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(" ");
  }
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
