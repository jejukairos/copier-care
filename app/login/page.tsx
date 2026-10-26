"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    setLoading(false);
    if (error) {
      const msg: Record<string, string> = {
        invalid_credentials: "이메일 또는 비밀번호가 맞지 않습니다.",
        email_not_confirmed: "이메일 인증이 안 된 계정입니다. 관리자에게 문의하세요.",
      };
      return setError(msg[error.code ?? ""] ?? `로그인 실패: ${error.message}`);
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-2xl font-bold">정기점검 관리</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">이메일</span>
          <input name="email" type="email" required autoComplete="email" className="rounded-lg border border-gray-300 px-3 py-3 text-base" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">비밀번호</span>
          <input name="password" type="password" required autoComplete="current-password" className="rounded-lg border border-gray-300 px-3 py-3 text-base" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="mt-2 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white disabled:opacity-50">
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <p className="text-center text-xs text-gray-500">계정은 관리자에게 요청하세요.</p>
    </main>
  );
}
