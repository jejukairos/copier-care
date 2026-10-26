import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";

// 로그인 필수 페이지에서 사용. admin 전용이면 adminOnly.
export async function requireMe({ adminOnly = false } = {}) {
  const me = await getMe();
  if (!me) redirect("/login");
  const isAdmin = me.profile?.role === "admin" && me.profile.active;
  if (adminOnly && !isAdmin) redirect("/");
  return { ...me, isAdmin };
}

export function Page({ title, back, right, error, children }: {
  title: string; back?: string; right?: React.ReactNode; error?: string; children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-16">
      <header className="flex items-center gap-2">
        {back && <Link href={back} className="-ml-2 px-2 py-1 text-2xl" aria-label="뒤로">‹</Link>}
        <h1 className="flex-1 text-xl font-bold">{title}</h1>
        {right}
      </header>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {children}
    </main>
  );
}

// 폼 값 꺼내기: 빈 칸은 null
export const str = (f: FormData, k: string) => (String(f.get(k) ?? "").trim() || null);
export const num = (f: FormData, k: string) => { const v = str(f, k); return v === null ? null : Number(v.replace(/,/g, "")); };
