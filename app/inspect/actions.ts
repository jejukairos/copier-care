"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { num, str } from "@/lib/page";

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
  const photos = form.getAll("photo").map(String).filter((p) => p.startsWith(`${machineId}/`));

  // 입력칸 p_{소모품id} = %, s_{소모품id} = 상태(양호 등). 둘 다 비면 기록 안 함
  const typeIds = new Set([...form.keys()].filter((k) => /^[ps]_\d+$/.test(k)).map((k) => Number(k.slice(2))));
  const readings = [...typeIds]
    .map((id) => ({ consumable_type_id: id, percent: num(form, `p_${id}`), status: str(form, `s_${id}`) }))
    .filter((r) => r.percent !== null || r.status !== null);
  if (readings.some((r) => r.percent !== null && !(Number.isInteger(r.percent) && r.percent >= 0 && r.percent <= 100)))
    fail("소모품 %는 0~100 사이 숫자로 입력하세요.");
  if ([mono, color].some((v) => v !== null && !(Number.isInteger(v) && v >= 0))) fail("카운터는 숫자로 입력하세요.");
  if (!readings.length && mono === null && color === null && !photos.length) fail("입력한 내용이 없습니다.");

  // 카운터가 직전 기록보다 작으면 메모 필수
  const { data: prev } = await supabase.from("inspections").select("mono_counter, color_counter")
    .eq("machine_id", machineId).lt("inspected_on", on).order("inspected_on", { ascending: false }).limit(1).maybeSingle();
  const down = (v: number | null, old: number | null | undefined) => v !== null && old != null && v < old;
  if ((down(mono, prev?.mono_counter) || down(color, prev?.color_counter)) && !memo)
    fail("카운터가 지난번보다 작습니다. 이유를 메모에 적어주세요.");

  // 사용량 = 이번 정기 − 직전 정기 (수시방문은 정산 제외)
  // shortcut: 초과매수·추가임대료 스냅샷은 아직 안 넣음, ④ 월별 리포트 때 계약단가로 계산해 추가
  const { data: prevReg } = period
    ? await supabase.from("inspections").select("mono_counter, color_counter").eq("machine_id", machineId)
      .eq("kind", "regular").lt("period_month", period).order("period_month", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const usage = (v: number | null, old: number | null | undefined) => (v !== null && old != null ? v - old : null);

  const row = {
    machine_id: machineId, inspected_on: on, kind, period_month: period,
    mono_counter: mono, color_counter: color,
    mono_usage: usage(mono, prevReg?.mono_counter), color_usage: usage(color, prevReg?.color_counter),
    inspector_id: num(form, "inspector_id"), memo,
  };

  // 같은 달 정기점검을 다시 올리면 새로 만들지 않고 그 기록에 덧씀 (이번에 비운 칸은 지난 값 유지)
  const { data: same } = period
    ? await supabase.from("inspections").select("id").eq("machine_id", machineId).eq("kind", "regular").eq("period_month", period).maybeSingle()
    : { data: null };
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
