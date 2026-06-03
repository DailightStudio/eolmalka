import { createClient } from "@supabase/supabase-js";

// 서버 푸시 알림용 Supabase 클라이언트.
// auth 세션·실시간 불필요 (anon key로 push_tokens / price_alerts upsert만).
// env 우선, 없으면 프로젝트 기본값 폴백.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://jxvjynujqecwebavmkyx.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4dmp5bnVqcWVjd2ViYXZta3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1Njc3NzAsImV4cCI6MjA5NTE0Mzc3MH0.1iHFfuZteR6zePczFXC4_ehKaq_kUuGWNfvokr-i9Fs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
