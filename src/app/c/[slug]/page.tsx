import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeries } from "@/lib/demo-series";
import {
  CATEGORY_META,
  CATEGORY_SLUGS,
  SIGNAL_STYLE,
  computeStats,
  forecastChange,
} from "@/lib/signals";
import { Sparkline } from "@/components/Sparkline";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((slug) => ({ slug }));
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const meta = CATEGORY_META[slug];
  if (!meta) notFound();

  const series = getSeries(slug);
  const stats = computeStats(series);
  const fcDelta = forecastChange(series);
  const s = SIGNAL_STYLE[stats.signal];

  return (
    <main className="mx-auto max-w-md px-5 py-6">
      <Link
        href="/"
        className="inline-block text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← 전체
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <div className="text-3xl">{meta.emoji}</div>
        <div>
          <h1 className="text-xl font-bold">{meta.name}</h1>
          <p className="text-xs text-zinc-500">{meta.subtitle}</p>
        </div>
      </header>

      <section className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">
            {stats.current.toLocaleString()}
          </span>
          <span className="text-sm text-zinc-500">{meta.unit}</span>
          <span
            className={`ml-auto text-sm font-semibold ${stats.change30d >= 0 ? "text-rose-400" : "text-lime-400"}`}
          >
            {stats.change30d >= 0 ? "+" : ""}
            {stats.change30d}%
            <span className="ml-1 text-[10px] text-zinc-500">30d</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">현재가 (데모)</p>
      </section>

      <section className={`mt-6 rounded-2xl border ${s.bg} p-4`}>
        <div className="flex items-center justify-between">
          <p className={`text-xs font-bold ${s.text}`}>{s.label}</p>
          <p className="text-[11px] text-zinc-400">
            예측 30d{" "}
            <span
              className={
                fcDelta >= 0 ? "text-rose-400" : "text-lime-400"
              }
            >
              {fcDelta >= 0 ? "+" : ""}
              {fcDelta}%
            </span>
          </p>
        </div>
        <p className="mt-1 text-sm">{stats.signalText}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-300">
          1년 추이 + 예측 30일
        </h2>
        <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2">
          <Sparkline
            past={series.past}
            forecast={series.forecast}
            width={360}
            height={180}
            stroke={s.stroke}
            smooth
            showAxis
          />
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          실선=과거 · 점선=예측. 현재 시점은 ●.
        </p>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="1주 변동" value={fmtPct(stats.change7d)} positive={stats.change7d > 0} />
        <Stat label="1개월 변동" value={fmtPct(stats.change30d)} positive={stats.change30d > 0} />
        <Stat label="1년 변동" value={fmtPct(stats.change365d)} positive={stats.change365d > 0} />
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <KeyVal label="MA30 (이동평균)" value={stats.ma30.toLocaleString()} />
        <KeyVal
          label="현재 vs MA30"
          value={fmtPct(((stats.current - stats.ma30) / stats.ma30) * 100)}
        />
      </section>

      <p className="mt-10 text-[11px] text-zinc-600">
        ※ 데모 화면. 실데이터·예측 모델 미연결 — 키 발급 후 `/api/*` 라우트에서
        주입할 예정. (`BACKLOG.md` 참조)
      </p>
    </main>
  );
}

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}%`;
}

function Stat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 p-3">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-sm font-bold ${positive ? "text-rose-400" : "text-lime-400"}`}
      >
        {value}
      </div>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 p-3">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-zinc-200">{value}</div>
    </div>
  );
}
