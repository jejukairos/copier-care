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
  if (error) redirect(`/clients/${id ?? "new"}?error=${encodeURIComponent("저장 실패: " + error.message)}`);
  redirect(`/clients/${data.id}`);
}
