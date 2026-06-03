import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, PanResponder, View } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import type { Point } from "@/lib/demo-series";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  past: Point[];
  forecast?: Point[];
  forecastBand?: { upper: number[]; lower: number[] };
  width?: number;
  height?: number;
  stroke?: string;
  smooth?: boolean;
};

type TooltipState = {
  x: number;
  y: number;
  point: Point;
  isForecast: boolean;
};

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

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

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

  // 터치 핸들러를 ref로 관리 — PanResponder는 한 번만 생성하되 최신 값 참조
  const touchHandlerRef = useRef<(touchX: number) => void>(() => {});
  touchHandlerRef.current = (touchX: number) => {
    const rawIdx = Math.round(((touchX - padX) / innerW) * (all.length - 1));
    const idx = Math.max(0, Math.min(all.length - 1, rawIdx));
    const point = all[idx];
    setTooltip({
      x: xAt(idx),
      y: yAt(point.value),
      point,
      isForecast: idx >= past.length,
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) =>
        touchHandlerRef.current(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) =>
        touchHandlerRef.current(evt.nativeEvent.locationX),
      onPanResponderRelease: () => setTooltip(null),
      onPanResponderTerminate: () => setTooltip(null),
    }),
  ).current;

  // 라인 경로
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

  // 현재 시점 펄스
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const pulseR = pulse.interpolate({ inputRange: [0, 1], outputRange: [2.5, 9] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] });

  // 신뢰구간 영역
  let bandPath = "";
  if (forecastBand && forecast.length > 0) {
    const upperPts: Array<[number, number]> = forecastBand.upper.map((v, i) => [
      xAt(fcOffset + 1 + i),
      yAt(v),
    ]);
    const lowerPts: Array<[number, number]> = forecastBand.lower
      .map((v, i): [number, number] => [xAt(fcOffset + 1 + i), yAt(v)])
      .reverse();
    const startX = xAt(fcOffset);
    const startY = yAt(past[past.length - 1].value);
    const pts = [[startX, startY], ...upperPts, ...lowerPts, [startX, startY]];
    bandPath =
      pts
        .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
        .join(" ") + " Z";
  }

  // 툴팁 렌더링
  let tooltipElem: React.ReactNode = null;
  if (tooltip) {
    const { x: tx, y: ty, point, isForecast } = tooltip;
    // "06/03" 형식 날짜
    const dateStr = point.date.slice(5).replace("-", "/");
    const priceStr = fmtPrice(point.value) + (isForecast ? " (예측)" : "");
    const label = `${dateStr}  ${priceStr}`;

    // 툴팁 박스 (넓이 추정: 글자당 ~6.5px + 여백 12px)
    const tipW = Math.min(180, Math.max(90, label.length * 6.5 + 12));
    const tipH = 20;
    const tipY = padY + 2;
    const tipX = Math.max(padX, Math.min(width - padX - tipW, tx - tipW / 2));

    tooltipElem = (
      <G>
        {/* 수직 크로스헤어 */}
        <Line
          x1={tx}
          y1={padY}
          x2={tx}
          y2={height - padY}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1}
        />
        {/* 툴팁 배경 */}
        <Rect
          x={tipX}
          y={tipY}
          width={tipW}
          height={tipH}
          fill="rgba(15,18,28,0.90)"
          rx={4}
        />
        {/* 툴팁 텍스트 */}
        <SvgText
          x={tipX + tipW / 2}
          y={tipY + 13.5}
          textAnchor="middle"
          fill="#e6eef8"
          fontSize={10.5}
          fontWeight="500"
        >
          {label}
        </SvgText>
        {/* 크로스헤어 교차점 마커 */}
        <Circle cx={tx} cy={ty} r={4} fill={stroke} opacity={0.35} />
        <Circle cx={tx} cy={ty} r={2.5} fill={stroke} />
        <Circle cx={tx} cy={ty} r={1} fill="#fff" />
      </G>
    );
  }

  return (
    <View {...panResponder.panHandlers} style={{ width, height }}>
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
        {/* 툴팁 없을 때만 펄스 표시 */}
        {!tooltip && (
          <AnimatedCircle cx={cx} cy={cy} r={pulseR} fill={stroke} opacity={pulseOpacity} />
        )}
        {!tooltip && <Circle cx={cx} cy={cy} r={2.5} fill={stroke} />}
        {tooltipElem}
      </Svg>
    </View>
  );
}

// 숫자 → 콤마 구분 문자열 (소수점 있으면 유지)
function fmtPrice(v: number): string {
  if (v >= 1000) return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (Math.round(v * 100) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
