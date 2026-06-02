import Link from "next/link";
import { getSeries } from "@/lib/demo-series";
import {
  CATEGORY_META,
  CATEGORY_SLUGS,
  SIGNAL_STYLE,
  computeStats,
} from "@/lib/signals";
import { Sparkline } from "@/components/Sparkline";

export const revalidate = 3600; // 시간당 재생성 — Frankfurter 캐싱과 정렬

export default async function HomePage() {
  const cards = await Promise.all(
    CATEGORY_SLUGS.map(async (slug) => {
      const series = await getSeries(slug);
      const meta = CATEGORY_META[slug];
      const stats = computeStats(series);
      return { slug, meta, series, stats };
    }),
  );

  const anyLive = cards.some((c) => c.series.source === "live");

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-widest text-lime-400">얼말까</p>
          <span
            className={`text-[10px] font-medium ${anyLive ? "text-lime-400" : "text-zinc-500"}`}
          >
            {anyLive ? "● 실데이터 (환율)" : "○ 더미 데이터"}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight">
          지금 살까,
          <br />
          기다릴까?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          환율·주유비·항공권·금. 과거 + 현재 + 예측을 한 화면에서. 너의 결정만
          남기면 됨.
        </p>
      </header>

      <section className="space-y-3">
        {cards.map(({ slug, meta, series, stats }) => {
          const s = SIGNAL_STYLE[stats.signal];
          const positive = stats.change30d > 0;
          return (
            <Link
              key={slug}
              href={`/c/${slug}`}
              className={`block rounded-2xl border ${s.bg} p-4 transition active:scale-[0.99]`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{meta.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-zinc-100 truncate">
                      {meta.name}
                    </h2>
                    {series.source === "live" && (
                      <span className="shrink-0 text-[9px] font-bold text-lime-400">
                        LIVE
                      </span>
                    )}
                    <span
                      className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${s.text}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {meta.subtitle}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-zinc-100">
                      {stats.current.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-zinc-500">{meta.unit}</span>
                    <span
                      className={`ml-auto text-xs font-semibold ${positive ? "text-rose-400" : "text-lime-400"}`}
                    >
                      {positive ? "+" : ""}
                      {stats.change30d}% · 30d
                    </span>
                  </div>
                  <div className="mt-2 -mx-1">
                    <Sparkline
                      past={series.past.slice(-90)}
                      forecast={series.forecast}
                      width={320}
                      height={48}
                      stroke={s.stroke}
                      smooth
                    />
                  </div>
                  <p className={`mt-1 text-[12px] ${s.text}`}>
                    {stats.signalText}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <p className="mt-10 text-[11px] leading-relaxed text-zinc-600">
        ※ 환율은 ECB 기반 무료 데이터(Frankfurter), 나머지는 결정론적 더미.
        통계 신호는 참고용이며 투자 자문이 아닙니다.
      </p>
    </main>
  );
}
