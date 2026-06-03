// Supabase Edge Function: news-sentiment
// 클라가 노출할 수 없는 OPENROUTER_KEY를 서버 측에서 보관 + Gemini 호출 → 결과만 클라에 반환.
//
// 배포:
//   1) 새 Supabase 프로젝트 (또는 기존). dashboard에서 OPENROUTER_KEY 시크릿 등록:
//      supabase secrets set OPENROUTER_KEY=sk-or-v1-...
//   2) 함수 배포:
//      supabase functions deploy news-sentiment --no-verify-jwt
//   3) 클라 .env.local 에 함수 URL 추가:
//      EXPO_PUBLIC_NEWS_PROXY_URL=https://<project-ref>.supabase.co/functions/v1/news-sentiment
//
// 보안 옵션:
//   - --no-verify-jwt 대신 anon-key 헤더 검증으로 익명 호출 차단 가능
//   - 카테고리·rate-limit·IP 차단을 함수 안에서 추가 가능
//
// 클라(news-provider.ts)는 NEWS_PROXY_URL 있으면 프록시 우선 사용, 없으면 OpenRouter 직호출.

const OPENROUTER_KEY = Deno.env.get("OPENROUTER_KEY");
const MODEL = "google/gemini-2.5-flash";

type RequestBody = {
  category: string;
  headlines: string[];
};

type LLMResponse = {
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  if (!OPENROUTER_KEY) {
    return json({ error: "OPENROUTER_KEY missing on server" }, 500);
  }
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { category, headlines } = body;
  if (!category || !Array.isArray(headlines) || headlines.length === 0) {
    return json({ error: "category + headlines[] required" }, 400);
  }
  // 간단한 입력 sanitize (긴 헤드라인·과도한 개수 차단)
  const safe = headlines.slice(0, 10).map((h) => String(h).slice(0, 300));

  const prompt =
    `다음은 "${category}"에 대한 최근 한국·해외 뉴스 헤드라인입니다(한국어/영어 혼합). ` +
    `한국 사용자가 사거나(또는 보유) 입장에서 가격이 오를 압력(bullish) / 내릴 압력(bearish) / 중립(neutral) 중 하나를 고르고, ` +
    `confidence(0.0~1.0)와 함께 핵심 흐름을 50자 이내 한국어로 요약하세요.\n\n헤드라인:\n` +
    safe.map((h, i) => `${i + 1}. ${h}`).join("\n") +
    `\n\nJSON만 출력: {"sentiment":"bullish|bearish|neutral","confidence":0.0~1.0,"summary":"..."}`;

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://eolmalka.app",
        "X-Title": "eolmalka",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "당신은 한국 시세 분석가입니다. 정확한 JSON만 출력." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
      }),
    });
    if (!upstream.ok) {
      return json({ error: `upstream ${upstream.status}` }, 502);
    }
    const j = await upstream.json();
    const raw = j?.choices?.[0]?.message?.content ?? "";
    let parsed: Partial<LLMResponse> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const sm = /(bullish|bearish|neutral)/i.exec(raw);
      const cm = /"?confidence"?\s*:\s*([0-9.]+)/i.exec(raw);
      parsed = {
        sentiment: (sm?.[1]?.toLowerCase() as LLMResponse["sentiment"]) ?? "neutral",
        confidence: cm ? Number(cm[1]) : undefined,
        summary: String(raw).slice(0, 40),
      };
    }
    const sentiment: LLMResponse["sentiment"] =
      parsed.sentiment === "bullish" || parsed.sentiment === "bearish"
        ? parsed.sentiment
        : "neutral";
    const confRaw = Number(parsed.confidence);
    const confidence = Number.isFinite(confRaw)
      ? Math.max(0, Math.min(1, confRaw))
      : 0.6;
    return json({
      sentiment,
      confidence,
      summary: (parsed.summary ?? "").trim().slice(0, 60) || "최근 헤드라인 기반 분석",
    });
  } catch (e) {
    return json({ error: `proxy failed: ${(e as Error).message}` }, 500);
  }
});

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
