"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/page";

export async function saveClient(form: FormData) {
  const supabase = await createClient();
  const id = str(form, "id");
  const row = {
    name: str(form, "name"),
    contact_name: str(form, "contact_name"),
    phone: str(form, "phone"),
    address: str(form, "address"),
  };
  if (!row.name) redirect(`/clients/${id ?? "new"}?error=${encodeURIComponent("회사명을 입력하세요.")}`);

  const { data, error } = id
    ? await supabase.from("clients").update(row).eq("id", id).select("id").single()
    : await supabase.from("clients").insert(row).select("id").single();
  // 같은 회사명은 DB에서 막힘(0006) → 새로 만들려던 거면 이미 있는 거래처로 이동 (저장 두 번 눌러도 1개만)
  if (error?.code === "23505" && !id) {
    const { data: old } = await supabase.from("clients").select("id").eq("name", row.name!).single();
    if (old) redirect(`/clients/${old.id}`);
  }
  if (error) redirect(`/clients/${id ?? "new"}?error=${encodeURIComponent(error.code === "23505" ? "같은 회사명이 이미 있습니다." : "저장 실패: " + error.message)}`);
  // 새 거래처는 바로 기계 등록(사진으로)으로
  redirect(id ? `/clients/${data.id}` : `/machines/new?client=${data.id}`);
}
