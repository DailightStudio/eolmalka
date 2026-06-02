import { ImageResponse } from "next/og";

export const dynamic = "force-static";

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
          fontSize: 256,
          fontWeight: 800,
          letterSpacing: -10,
        }}
      >
        ₩?
      </div>
    ),
    { width: 512, height: 512 },
  );
}
