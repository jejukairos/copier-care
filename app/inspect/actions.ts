"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { num, str } from "@/lib/page";
import { NEW_PHOTO } from "./photos";
import { isReplaced } from "./replaced";

export async function saveInspection(form: FormData) {
  const supabase = await createClient();
  const machineId = num(form, "machine_id");
  const back = `/inspect?q=${encodeURIComponent(str(form, "serial") ?? "")}`;
  const fail = (msg: string): never => redirect(`${back}&error=${encodeURIComponent(msg)}`);
  if (!machineId) fail("기계를 다시 선택하세요.");

  const on = str(form, "inspected_on") ?? fail("점검일을 입력하세요.");
  const kind = form.get("kind") === "visit" ? "visit" : "regular";
  const period = kind === "regular" ? `${on.slice(0, 7)}-01` : null;
  const mono = num(form, "mono_counter");
  const color = num(form, "color_counter");
  const memo = str(form, "memo");
  const photos = form.getAll("photo").map(String).filter((p) => p.startsWith(`${machineId}/`) || NEW_PHOTO.test(p));

  // 입력칸 p_{소모품id} = %, s_{소모품id} = 상태(양호 등). 둘 다 비면 기록 안 함
  const typeIds = new Set([...form.keys()].filter((k) => /^[ps]_\d+$/.test(k)).map((k) => Number(k.slice(2))));
  const entered = [...typeIds]
    .map((id) => ({ consumable_type_id: id, percent: num(form, `p_${id}`), status: str(form, `s_${id}`) }))
    .filter((r) => r.percent !== null || r.status !== null);
  if (entered.some((r) => r.percent !== null && !(Number.isInteger(r.percent) && r.percent >= 0 && r.percent <= 100)))
    fail("소모품 %는 0~100 사이 숫자로 입력하세요.");

  // 서버(미국)↔DB(서울) 왕복이 느려서 조회 4개를 한꺼번에
  // before = 교체 자동 판단용 소모품별 직전 기록, prev = 카운터 감소 확인, prevReg = 사용량 계산(정기끼리), same = 같은 달 정기점검(덧쓰기)
  const [{ data: before }, { data: prev }, { data: prevReg }, { data: same }] = await Promise.all([
    supabase.from("consumable_readings")
      .select("consumable_type_id, percent, status, inspections!inner(inspected_on, machine_id)")
      .eq("inspections.machine_id", machineId!).lt("inspections.inspected_on", on),
    supabase.from("inspections").select("mono_counter, color_counter")
      .eq("machine_id", machineId!).lt("inspected_on", on).order("inspected_on", { ascending: false }).limit(1).maybeSingle(),
    period
      ? supabase.from("inspections").select("mono_counter, color_counter").eq("machine_id", machineId!)
        .eq("kind", "regular").lt("period_month", period).order("period_month", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    period
      ? supabase.from("inspections").select("id, extra_counters").eq("machine_id", machineId!).eq("kind", "regular").eq("period_month", period).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const prevOf = new Map<number, { percent: number | null; status: string | null; on: string }>();
  for (const b of (before ?? []) as unknown as { consumable_type_id: number; percent: number | null; status: string | null; inspections: { inspected_on: string } }[]) {
    const p = prevOf.get(b.consumable_type_id);
    if (!p || b.inspections.inspected_on > p.on) prevOf.set(b.consumable_type_id, { ...b, on: b.inspections.inspected_on });
  }
  const readings = entered.map((r) => ({ ...r, replaced: isReplaced(prevOf.get(r.consumable_type_id), r) }));
  // 흑백·칼라 외 카운터 c_{칸이름} → {"칸이름": 숫자}
  const extra: Record<string, number> = {};
  for (const k of [...form.keys()].filter((k) => k.startsWith("c_")).slice(0, 6)) {
    const v = num(form, k);
    if (v !== null) extra[k.slice(2, 40)] = v;
  }
  if ([mono, color, ...Object.values(extra)].some((v) => v !== null && !(Number.isInteger(v) && v >= 0))) fail("카운터는 숫자로 입력하세요.");
  if (!readings.length && mono === null && color === null && !Object.keys(extra).length && !photos.length) fail("입력한 내용이 없습니다.");

  // 카운터가 직전 기록보다 작으면 메모 필수
  const down = (v: number | null, old: number | null | undefined) => v !== null && old != null && v < old;
  if ((down(mono, prev?.mono_counter) || down(color, prev?.color_counter)) && !memo)
    fail("카운터가 지난번보다 작습니다. 이유를 메모에 적어주세요.");

  // 사용량 = 이번 정기 − 직전 정기 (수시방문은 정산 제외)
  // shortcut: 초과매수·추가임대료 스냅샷은 아직 안 넣음, ④ 월별 리포트 때 계약단가로 계산해 추가
  const usage = (v: number | null, old: number | null | undefined) => (v !== null && old != null ? v - old : null);

  // 같은 달 정기점검을 다시 올리면 새로 만들지 않고 그 기록에 덧씀 (이번에 비운 칸은 지난 값 유지)
  const extras = { ...same?.extra_counters, ...extra };

  const row = {
    machine_id: machineId, inspected_on: on, kind, period_month: period,
    mono_counter: mono, color_counter: color, extra_counters: Object.keys(extras).length ? extras : null,
    mono_usage: usage(mono, prevReg?.mono_counter), color_usage: usage(color, prevReg?.color_counter),
    memo,
  };
  const { data: saved, error } = same
    ? await supabase.from("inspections").update(Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null))).eq("id", same.id).select("id").single()
    : await supabase.from("inspections").insert(row).select("id").single();
  if (error || !saved) return fail("저장 실패: " + error?.message);

  if (readings.length) {
    const { error: e } = await supabase.from("consumable_readings").upsert(readings.map((r) => ({ ...r, inspection_id: saved.id })));
    if (e) fail("점검은 저장됐지만 소모품 저장 실패: " + e.message);
  }
  if (photos.length) {
    const { error: e } = await supabase.from("inspection_photos").insert(photos.map((path) => ({ inspection_id: saved.id, path })));
    if (e) fail("점검은 저장됐지만 사진 연결 실패: " + e.message);
  }
  redirect(`/machines/${machineId}?saved=1`);
}
