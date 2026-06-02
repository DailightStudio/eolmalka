import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, SIGNAL_STYLE } from "@/lib/demo-categories";

type Params = Promise<{ slug: string }>;

export default async function CategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const c = CATEGORIES.find((x) => x.slug === slug);
  if (!c) notFound();
  const s = SIGNAL_STYLE[c.signal];

  return (
    <main className="mx-auto max-w-md px-5 py-6">
      <Link
        href="/"
        className="inline-block text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← 전체
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <div className="text-3xl">{c.emoji}</div>
        <div>
          <h1 className="text-xl font-bold">{c.name}</h1>
          <p className="text-xs text-zinc-500">{c.subtitle}</p>
        </div>
      </header>

      <section className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">
            {c.current.toLocaleString()}
          </span>
          <span className="text-sm text-zinc-500">{c.unit}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">현재가 (데모)</p>
      </section>

      <section
        className={`mt-6 rounded-2xl border ${s.bg} p-4`}
      >
        <p className={`text-xs font-bold ${s.text}`}>{s.label}</p>
        <p className="mt-1 text-sm">{c.signalText}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-300">
          시세 차트 (자리)
        </h2>
        <div className="mt-2 h-48 rounded-xl border border-zinc-800 bg-zinc-900/40 grid place-items-center text-xs text-zinc-600">
          과거 1년 + 예측 30일 — 차트 라이브러리 미연결
        </div>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="1주 변동" value="—" />
        <Stat label="1개월 변동" value={`${c.change30d > 0 ? "+" : ""}${c.change30d}%`} />
        <Stat label="1년 변동" value="—" />
      </section>

      <p className="mt-10 text-[11px] text-zinc-600">
        ※ 데모 화면. 실데이터·예측 모델 미연결.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 p-3">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}
