import Link from "next/link";
import { getSeries } from "@/lib/demo-series";
import {
  CATEGORY_META,
  CATEGORY_SLUGS,
  SIGNAL_STYLE,
  computeStats,
} from "@/lib/signals";
import { Sparkline } from "@/components/Sparkline";

export default function HomePage() {
  const cards = CATEGORY_SLUGS.map((slug) => {
    const series = getSeries(slug);
    const meta = CATEGORY_META[slug];
    const stats = computeStats(series);
    return { slug, meta, series, stats };
  });

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6">
        <p className="text-xs font-bold tracking-widest text-lime-400">얼말까</p>
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
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${s.text}`}
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
                    <span className="text-[11px] text-zinc-500">
                      {meta.unit}
                    </span>
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
        ※ 위 수치는 결정론적 데모 데이터입니다 (`lib/demo-series.ts`). 실데이터
        API 연동 전까지는 의사결정에 활용하지 마세요.
      </p>
    </main>
  );
}
