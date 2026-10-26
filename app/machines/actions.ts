"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { num, str } from "@/lib/page";

const fail = (path: string, msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}`);

export async function saveMachine(form: FormData) {
  const supabase = await createClient();
  const id = str(form, "id");
  const back = id ? `/machines/${id}` : `/machines/new?client=${str(form, "client_id")}`;
  const row = {
    serial: str(form, "serial")?.toUpperCase(),
    client_id: num(form, "client_id"),
    model: str(form, "model"),
    color_type: str(form, "color_type"),
    tray_count: num(form, "tray_count"),
    installed_on: str(form, "installed_on"),
    staff_id: num(form, "staff_id"),
    inspection_day: num(form, "inspection_day"),
    memo: str(form, "memo"),
    ...(id ? { active: form.get("active") === "on" } : {}),
  };
  if (!row.serial || !row.model || !row.client_id) fail(back, "기계번호·거래처·기종은 필수입니다.");

  const { data, error } = id
    ? await supabase.from("machines").update(row).eq("id", id).select("id").single()
    : await supabase.from("machines").insert(row).select("id").single();
  if (error) fail(back, error.code === "23505" ? `기계번호 ${row.serial}는 이미 등록되어 있습니다.` : "저장 실패: " + error.message);

  // 계약 (관리자만 입력란이 보임). 같은 적용일이면 수정, 새 적용일이면 이력 추가.
  if (form.has("starts_on")) {
    const contract = {
      machine_id: data!.id,
      starts_on: str(form, "starts_on"),
      base_mono: num(form, "base_mono") ?? 0,
      base_color: num(form, "base_color") ?? 0,
      monthly_fee: num(form, "monthly_fee") ?? 0,
      over_mono_price: num(form, "over_mono_price") ?? 0,
      over_color_price: num(form, "over_color_price") ?? 0,
    };
    const { error: cErr } = await supabase.from("contracts").upsert(contract, { onConflict: "machine_id,starts_on" });
    if (cErr) fail(`/machines/${data!.id}`, "기계는 저장됐지만 계약 저장 실패: " + cErr.message);
  }
  redirect(`/machines/${data!.id}?saved=1`);
}

export async function addPartReplacement(form: FormData) {
  const supabase = await createClient();
  const machineId = str(form, "machine_id");
  const { error } = await supabase.from("part_replacements").insert({
    machine_id: machineId,
    part_type_id: num(form, "part_type_id"),
    replaced_on: str(form, "replaced_on"),
    counter_at: num(form, "counter_at"),
    replaced_by: num(form, "replaced_by"),
    memo: str(form, "memo"),
  });
  if (error) fail(`/machines/${machineId}`, "교체이력 저장 실패: " + error.message);
  redirect(`/machines/${machineId}#parts`);
}

export async function deletePartReplacement(form: FormData) {
  const supabase = await createClient();
  const machineId = str(form, "machine_id");
  const { error } = await supabase.from("part_replacements").delete().eq("id", str(form, "id"));
  if (error) fail(`/machines/${machineId}`, "삭제 실패: " + error.message);
  redirect(`/machines/${machineId}#parts`);
}
