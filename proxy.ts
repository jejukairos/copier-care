import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 세션 쿠키 갱신 + 비로그인 사용자는 /login 으로
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // getClaims: 로그인 토큰을 서버 안에서 서명 확인 (매번 Supabase에 묻는 getUser보다 빠름, 만료 시 갱신도 함)
  let signedIn = !!(await supabase.auth.getClaims()).data?.claims;
  // 로그인 화면 없이 쓰기: 세션이 없으면 Netlify 환경변수의 공용계정으로 자동 로그인 (실패하면 기존 로그인 화면)
  const email = process.env.SHARED_LOGIN_EMAIL, password = process.env.SHARED_LOGIN_PASSWORD;
  if (!signedIn && email && password) {
    signedIn = !!(await supabase.auth.signInWithPassword({ email, password })).data.user;
    if (signedIn && request.nextUrl.pathname.startsWith("/login")) {
      const go = NextResponse.redirect(new URL("/", request.url));
      response.cookies.getAll().forEach((c) => go.cookies.set(c));
      return go;
    }
  }
  if (!signedIn && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
