import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          // 서버 컴포넌트에서는 쿠키를 못 씀 → proxy.ts가 세션 갱신을 담당
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}

// 로그인한 직원과 프로필. 비로그인이면 null.
export async function getMe() {
  const supabase = await createClient();
  // getClaims: 토큰 서명을 서버 안에서 확인 (getUser처럼 Supabase에 왕복하지 않음 — 서버가 미국이라 왕복마다 느림)
  const claims = (await supabase.auth.getClaims()).data?.claims;
  if (!claims) return null;
  const { data: profile } = await supabase.from("profiles").select("name, role, active").eq("id", claims.sub).single();
  return { user: { id: claims.sub, email: claims.email }, profile };
}
