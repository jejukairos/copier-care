type R = { percent: number | null; status: string | null };

// 직전 기록 대비 %가 30 이상 오르거나, 상태가 "…교체…"(교체필요·소모품교체준비 등) → 다른 값으로 바뀌면 교체한 것
export function isReplaced(prev: R | undefined, cur: R) {
  if (!prev) return false;
  if (prev.percent !== null && cur.percent !== null && cur.percent - prev.percent >= 30) return true;
  return !!prev.status?.includes("교체") && cur.status !== null && !cur.status.includes("교체");
}
