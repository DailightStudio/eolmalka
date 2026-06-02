import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: -4,
        }}
      >
        ₩?
      </div>
    ),
    { ...size },
  );
}
