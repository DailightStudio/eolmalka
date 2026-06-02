import { getSeries } from "@/lib/demo-series";
import { CATEGORY_META, CATEGORY_SLUGS, computeStats } from "@/lib/signals";
import { CardList, type CardData } from "@/components/CardList";
import { NotifyButton } from "@/components/NotifyButton";

export const revalidate = 3600;

export default async function HomePage() {
  const cards: CardData[] = await Promise.all(
    CATEGORY_SLUGS.map(async (slug): Promise<CardData> => {
      const series = await getSeries(slug);
      const meta = CATEGORY_META[slug];
      const stats = computeStats(series);
      return {
        slug,
        meta,
        spark: {
          past: series.past.slice(-90),
          forecast: series.forecast,
        },
        stats: {
          current: stats.current,
          change30d: stats.change30d,
          signal: stats.signal,
          signalText: stats.signalText,
        },
        isLive: series.source === "live",
      };
    }),
  );

  const anyLive = cards.some((c) => c.isLive);

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-widest text-lime-400">얼말까</p>
          <span
            className={`text-[10px] font-medium ${anyLive ? "text-lime-400" : "text-zinc-500"}`}
          >
            {anyLive ? "● 실데이터 연결됨" : "○ 더미 데이터"}
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

      <CardList cards={cards} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-300">
          홈 화면 + 가격 알림
        </h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          알림을 켜면 즐겨찾기 카테고리에 신호가 뜰 때 폰으로 푸시. iOS는
          공유 → 홈 화면 추가 후 활성화.
        </p>
        <div className="mt-3">
          <NotifyButton />
        </div>
      </section>

      <p className="mt-10 text-[11px] leading-relaxed text-zinc-600">
        ※ 환율은 Frankfurter(ECB), 휘발유는 오피넷. 그 외는 데모. 통계 신호는
        참고용이며 투자 자문이 아닙니다.
      </p>
    </main>
  );
}
