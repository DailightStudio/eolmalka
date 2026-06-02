"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sparkline } from "./Sparkline";
import { SIGNAL_STYLE, type Signal } from "@/lib/signals";
import type { Point } from "@/lib/demo-series";

type SortMode = "default" | "signal" | "change";

export type CardData = {
  slug: string;
  meta: { name: string; subtitle: string; unit: string; emoji: string };
  spark: { past: Point[]; forecast: Point[] };
  stats: { current: number; change30d: number; signal: Signal; signalText: string };
  isLive: boolean;
};

const FAVS_KEY = "eolmalka:favs:v1";
const SORT_KEY = "eolmalka:sort:v1";

export function CardList({ cards }: { cards: CardData[] }) {
  const [favs, setFavs] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<SortMode>("default");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const f = localStorage.getItem(FAVS_KEY);
      if (f) setFavs(new Set(JSON.parse(f) as string[]));
      const s = localStorage.getItem(SORT_KEY) as SortMode | null;
      if (s === "default" || s === "signal" || s === "change") setSort(s);
    } catch {
      // localStorage 차단 — 무시
    }
    setHydrated(true);
  }, []);

  const toggle = (slug: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      try {
        localStorage.setItem(FAVS_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const setSortMode = (m: SortMode) => {
    setSort(m);
    try {
      localStorage.setItem(SORT_KEY, m);
    } catch {}
  };

  const sorted = useMemo(() => {
    if (!hydrated) return cards;
    const list = cards.map((c, i) => ({ c, i }));
    list.sort((a, b) => {
      const af = favs.has(a.c.slug) ? 1 : 0;
      const bf = favs.has(b.c.slug) ? 1 : 0;
      if (af !== bf) return bf - af;
      if (sort === "signal") {
        const rank = (s: Signal) => (s === "buy" ? 0 : s === "wait" ? 2 : 1);
        return rank(a.c.stats.signal) - rank(b.c.stats.signal);
      }
      if (sort === "change") {
        return Math.abs(b.c.stats.change30d) - Math.abs(a.c.stats.change30d);
      }
      return a.i - b.i; // 원순
    });
    return list.map((x) => x.c);
  }, [cards, favs, sort, hydrated]);

  return (
    <>
      <div className="mb-3 flex gap-1 text-[11px]">
        <SortChip active={sort === "default"} onClick={() => setSortMode("default")}>
          기본
        </SortChip>
        <SortChip active={sort === "signal"} onClick={() => setSortMode("signal")}>
          신호
        </SortChip>
        <SortChip active={sort === "change"} onClick={() => setSortMode("change")}>
          변동률
        </SortChip>
      </div>

      <section className="space-y-3">
        {sorted.map(({ slug, meta, spark, stats, isLive }) => {
          const s = SIGNAL_STYLE[stats.signal];
          const positive = stats.change30d > 0;
          const isFav = favs.has(slug);
          return (
            <article
              key={slug}
              className={`relative rounded-2xl border ${s.bg}`}
            >
              <button
                type="button"
                aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
                onClick={() => toggle(slug)}
                className={`absolute right-3 top-3 z-10 text-lg leading-none ${isFav ? "text-amber-400" : "text-zinc-600"}`}
              >
                {isFav ? "★" : "☆"}
              </button>

              <Link
                href={`/c/${slug}`}
                className="block p-4 pr-9 transition active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{meta.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-zinc-100 truncate">
                        {meta.name}
                      </h2>
                      {isLive && (
                        <span className="shrink-0 text-[9px] font-bold text-lime-400">
                          LIVE
                        </span>
                      )}
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
                        past={spark.past}
                        forecast={spark.forecast}
                        width={320}
                        height={48}
                        stroke={s.stroke}
                        smooth
                      />
                    </div>
                    <p className={`mt-1 text-[12px] ${s.text}`}>
                      <span className="font-bold mr-1">{s.label}</span>
                      <span className="text-zinc-400">{stats.signalText}</span>
                    </p>
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </section>
    </>
  );
}

function SortChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 font-medium ${active ? "bg-zinc-100 text-zinc-900" : "border border-zinc-700 text-zinc-400"}`}
    >
      {children}
    </button>
  );
}
