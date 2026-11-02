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

  let { data: { user } } = await supabase.auth.getUser();
  // 로그인 화면 없이 쓰기: 세션이 없으면 Netlify 환경변수의 공용계정으로 자동 로그인 (실패하면 기존 로그인 화면)
  const email = process.env.SHARED_LOGIN_EMAIL, password = process.env.SHARED_LOGIN_PASSWORD;
  if (!user && email && password) {
    ({ data: { user } } = await supabase.auth.signInWithPassword({ email, password }));
    if (user && request.nextUrl.pathname.startsWith("/login")) {
      const go = NextResponse.redirect(new URL("/", request.url));
      response.cookies.getAll().forEach((c) => go.cookies.set(c));
      return go;
    }
  }
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
