import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function Home() {
  const me = await getMe();
  if (!me) redirect("/login");
  const { profile } = me;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{profile?.name ?? me.user.email}</p>
          <p className="text-xs text-gray-500">{profile?.role === "admin" ? "관리자" : "직원"}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm">로그아웃</button>
        </form>
      </header>
      {profile?.active === false ? (
        <p className="rounded-lg bg-red-50 p-4 text-red-700">사용이 중지된 계정입니다. 관리자에게 문의하세요.</p>
      ) : (
        <p className="rounded-lg bg-gray-50 p-4 text-gray-600">로그인 성공! 다음 단계에서 거래처·기계 화면이 여기에 생깁니다.</p>
      )}
    </main>
  );
}
