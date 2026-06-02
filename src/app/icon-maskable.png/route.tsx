import { ImageResponse } from "next/og";

export const dynamic = "force-static";

// maskable 아이콘은 안전 영역(safe zone)이 중앙 40%여야 함 — 글자를 작게.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f17",
          color: "#a3e635",
          fontSize: 180,
          fontWeight: 800,
          letterSpacing: -8,
        }}
      >
        ₩?
      </div>
    ),
    { width: 512, height: 512 },
  );
}
