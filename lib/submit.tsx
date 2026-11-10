"use client";

import { useFormStatus } from "react-dom";

// 누르면 응답 올 때까지 "저장 중…"으로 잠금 (서버가 미국이라 몇 초 걸림 → 여러 번 눌러 중복 저장되는 것 방지)
export function Submit({ label, className = "btn" }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={`${className} disabled:opacity-50`}>{pending ? `${label} 중…` : label}</button>;
}
