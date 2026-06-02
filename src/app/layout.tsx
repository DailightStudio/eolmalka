import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaSetup } from "@/components/PwaSetup";

export const metadata: Metadata = {
  title: "얼말까 — 지금 살까, 기다릴까?",
  description:
    "환율·주유비·항공권·금 시세를 한 화면에서. 과거+현재+미래 예측으로 '젤 쌀 때'를 알려줍니다.",
  appleWebApp: {
    capable: true,
    title: "얼말까",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
