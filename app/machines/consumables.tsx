import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Reading = { percent: number | null; status: string | null; consumable_types: { name: string; sort: number } | null };
export type Latest = {
  inspected_on: string; mono_usage?: number | null; color_usage?: number | null; consumable_readings: Reading[];
} | null | undefined;

type Rep = { consumable_types: { name: string; sort: number } | null; inspections: { inspected_on: string; mono_counter: number | null; color_counter: number | null } };

const won = (n: number) => n.toLocaleString("ko-KR");
const short = (name = "") => name.replace(/^토너 /, "");
const ymd = (d: string) => d.slice(2).replaceAll("-", ".");

// 기계의 최근 소모품을 "K 25% · 토너회수통 양호(26.10.07 교체)"처럼 보여주고, 아래에 교체 이력·평균 주기
export async function Consumables({ machineId, serial, latest }: { machineId: number; serial: string; latest: Latest }) {
  const supabase = await createClient();
  const [{ data: settings }, { data: reps }] = await Promise.all([
    supabase.from("app_settings").select("key, value").in("key", ["urgent_percent", "warning_percent"]),
    supabase.from("consumable_readings")
      .select("consumable_types(name, sort), inspections!inner(inspected_on, mono_counter, color_counter, machine_id)")
      .eq("replaced", true).eq("inspections.machine_id", machineId),
  ]);
  // 소모품별 교체일 (오래된 순). 평균 주기 = (마지막 − 처음) ÷ 교체 간격 수, 매수는 흑백+칼라 카운터 합
  const history = new Map<string, { sort: number; list: Rep["inspections"][] }>();
  for (const r of (reps ?? []) as unknown as Rep[]) {
    const name = r.consumable_types?.name ?? "";
    if (!history.has(name)) history.set(name, { sort: r.consumable_types?.sort ?? 0, list: [] });
    history.get(name)!.list.push(r.inspections);
  }
  const groups = [...history].toSorted(([, a], [, b]) => a.sort - b.sort).map(([name, { list }]) => {
    list.sort((a, b) => a.inspected_on.localeCompare(b.inspected_on));
    const n = list.length - 1, first = list[0], last = list[n];
    const pages = (i: Rep["inspections"]) => (i.mono_counter === null ? null : i.mono_counter + (i.color_counter ?? 0));
    const p0 = pages(first), p1 = pages(last);
    return {
      name, last: last.inspected_on, dates: list.map((i) => ymd(i.inspected_on)).reverse(),
      days: n ? Math.round((Date.parse(last.inspected_on) - Date.parse(first.inspected_on)) / 86400000 / n) : null,
      pages: n && p0 !== null && p1 !== null ? Math.round((p1 - p0) / n) : null,
    };
  });
  const lastReplaced = new Map(groups.map((g) => [g.name, g.last]));

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
              {short(r.consumable_types?.name)}{r.percent !== null && ` ${r.percent}%`}{r.status && ` ${r.status}`}
              {lastReplaced.has(r.consumable_types?.name ?? "") && (
                <span className="text-xs font-normal"> ({ymd(lastReplaced.get(r.consumable_types?.name ?? "")!)} 교체)</span>
              )}
            </span>
          ))}
        </div>
      ) : <p className="text-sm text-gray-500">소모품 기록이 없습니다. 📷 사진 올리기로 입력하세요.</p>}
      {latest?.mono_usage != null && (
        <p className="text-sm text-gray-600">
          지난 정기점검 대비 흑백 {won(latest.mono_usage)}매{latest.color_usage != null && ` · 칼라 ${won(latest.color_usage)}매`} 사용
        </p>
      )}
      <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-sm">
        <p className="font-semibold">교체 이력</p>
        {groups.map((g) => (
          <p key={g.name}>
            <span className="font-semibold">{short(g.name)}</span> {g.dates.join(" · ")}
            {g.days !== null && <span className="text-gray-500"> — 평균 {g.days}일{g.pages !== null && ` · ${won(g.pages)}매`}마다</span>}
          </p>
        ))}
        {groups.length === 0 && <p className="text-gray-500">아직 교체 기록이 없습니다. (%가 지난번보다 30 이상 오르거나 상태가 &apos;교체…&apos;→&apos;양호&apos;로 바뀌면 자동 기록)</p>}
      </div>
    </section>
  );
}
