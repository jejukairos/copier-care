import { redirect } from "next/navigation";
import { Page, num, requireMe, str } from "@/lib/page";
import { createClient } from "@/lib/supabase/server";

// 소모품(consumable_types)·부품(part_types) 항목 추가/수정. 삭제 대신 '사용 안 함'(과거 기록 보존).
async function saveItem(form: FormData) {
  "use server";
  const supabase = await createClient();
  const table = str(form, "table") === "part_types" ? "part_types" : "consumable_types";
  const id = str(form, "id");
  const row: Record<string, unknown> = {
    name: str(form, "name"),
    applies_to: str(form, "applies_to"),
    sort: num(form, "sort") ?? 0,
    active: form.get("active") !== "off",
  };
  if (table === "consumable_types") {
    row.is_main = form.get("is_main") === "on";
    if (!id) row.code = `C${Date.now()}`; // 내부 식별용
  }
  const { error } = id
    ? await supabase.from(table).update(row).eq("id", id)
    : await supabase.from(table).insert(row);
  redirect(error ? `/settings/items?error=${encodeURIComponent("저장 실패: " + error.message)}` : `/settings/items#${table}`);
}

const TARGETS = { color: "컬러기", mono: "흑백기", both: "공통" } as const;

export default async function ItemsPage({ searchParams }: PageProps<"/settings/items">) {
  await requireMe({ adminOnly: true });
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: consumables }, { data: parts }] = await Promise.all([
    supabase.from("consumable_types").select("*").order("applies_to").order("sort"),
    supabase.from("part_types").select("*").order("sort"),
  ]);

  const section = (table: "consumable_types" | "part_types", title: string, rows: typeof consumables) => (
    <section id={table} className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{title}</h2>
      {[...(rows ?? []), null].map((r) => (
        <form key={r?.id ?? "new"} action={saveItem} className={`card flex flex-col gap-2 ${r && !r.active ? "opacity-50" : ""}`}>
          <input type="hidden" name="table" value={table} />
          {r && <input type="hidden" name="id" value={r.id} />}
          {!r && <p className="text-sm font-semibold text-blue-600">+ 새 항목</p>}
          <div className="grid grid-cols-[1fr_auto_4rem] gap-2">
            <input name="name" required defaultValue={r?.name ?? ""} placeholder="이름" className="input" />
            <select name="applies_to" defaultValue={r?.applies_to ?? (table === "part_types" ? "both" : "color")} className="input">
              {Object.entries(TARGETS)
                .filter(([k]) => table === "part_types" || k !== "both")
                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input name="sort" inputMode="numeric" defaultValue={r?.sort ?? ""} placeholder="순서" className="input" />
          </div>
          <div className="flex items-center gap-3 text-sm">
            {table === "consumable_types" && (
              <label className="flex items-center gap-1"><input type="checkbox" name="is_main" defaultChecked={r?.is_main} className="size-5" /> 주요 교체</label>
            )}
            {r && (
              <select name="active" defaultValue={r.active ? "on" : "off"} className="input w-auto py-2">
                <option value="on">사용</option>
                <option value="off">사용 안 함</option>
              </select>
            )}
            {r?.tray_no && <span className="text-gray-500">트레이 수 {r.tray_no}개 이상 기계만 표시</span>}
            <button className="btn-outline ml-auto py-2">{r ? "수정" : "추가"}</button>
          </div>
        </form>
      ))}
    </section>
  );

  return (
    <Page title="소모품 · 부품 항목" back="/" error={error as string | undefined}>
      {section("consumable_types", "소모품 (점검 때 잔량 % 기록)", consumables)}
      {section("part_types", "부품 (교체이력)", parts)}
    </Page>
  );
}
