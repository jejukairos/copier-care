import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Reading = { percent: number | null; status: string | null; consumable_types: { name: string; sort: number } | null };
export type Latest = {
  inspected_on: string; mono_usage?: number | null; color_usage?: number | null; consumable_readings: Reading[];
} | null | undefined;

const won = (n: number) => n.toLocaleString("ko-KR");

// 기계의 최근 소모품을 "K 25% · C 55% · 토너회수통 양호"처럼 보여줌. 부족한 건 빨강/주황
export async function Consumables({ serial, latest }: { serial: string; latest: Latest }) {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("app_settings").select("key, value").in("key", ["urgent_percent", "warning_percent"]);
  const setting = (k: string, d: number) => Number(settings?.find((s) => s.key === k)?.value ?? d);
  const urgent = setting("urgent_percent", 10);
  const warning = setting("warning_percent", 20);
  const tone = (r: Reading) =>
    r.percent !== null && r.percent <= urgent ? "bg-red-100 text-red-700"
    : (r.percent !== null && r.percent <= warning) || r.status?.includes("교체") ? "bg-orange-100 text-orange-700"
    : "bg-gray-100";
  const readings = (latest?.consumable_readings ?? []).toSorted((a, b) => (a.consumable_types?.sort ?? 0) - (b.consumable_types?.sort ?? 0));

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">소모품{latest && <span className="text-sm font-normal text-gray-500"> · {latest.inspected_on.slice(2).replaceAll("-", ".")} 기준</span>}</h2>
        <Link href={`/inspect?q=${encodeURIComponent(serial)}`} className="shrink-0 text-sm font-semibold text-blue-600">📷 사진 올리기</Link>
      </div>
      {readings.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {readings.map((r) => (
            <span key={r.consumable_types?.name} className={`rounded-full px-3 py-1.5 font-semibold ${tone(r)}`}>
              {r.consumable_types?.name.replace(/^토너 /, "")}{r.percent !== null && ` ${r.percent}%`}{r.status && ` ${r.status}`}
            </span>
          ))}
        </div>
      ) : <p className="text-sm text-gray-500">소모품 기록이 없습니다. 📷 사진 올리기로 입력하세요.</p>}
      {latest?.mono_usage != null && (
        <p className="text-sm text-gray-600">
          지난 정기점검 대비 흑백 {won(latest.mono_usage)}매{latest.color_usage != null && ` · 칼라 ${won(latest.color_usage)}매`} 사용
        </p>
      )}
    </section>
  );
}
