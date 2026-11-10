import Link from "next/link";
import { notFound } from "next/navigation";
import { Page, requireMe } from "@/lib/page";
import { Submit } from "@/lib/submit";
import { createClient } from "@/lib/supabase/server";
import { Consumables, INSPECTION_FIELDS, type Latest } from "../../machines/consumables";
import { saveClient } from "../actions";

type M = { id: number; serial: string; model: string; color_type: string; active: boolean };

// /clients/new 도 이 화면 (id = "new"). 기계가 여러 대면 ?m=기계id 로 선택, 기본은 첫 기계
export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  await requireMe();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const supabase = await createClient();

  const { data: c } = isNew
    ? { data: null }
    : await supabase.from("clients").select("*, machines(id, serial, model, color_type, active)").eq("id", id).single();
  if (!isNew && !c) notFound();

  const machines = ((c?.machines ?? []) as M[]).toSorted((a, b) => Number(b.active) - Number(a.active) || a.id - b.id);
  const sel = machines.find((m) => String(m.id) === sp.m) ?? machines[0];
  const { data: recent } = sel
    ? await supabase.from("inspections").select(INSPECTION_FIELDS)
        .eq("machine_id", sel.id).order("inspected_on", { ascending: false }).order("id", { ascending: false }).limit(2)
    : { data: null };
  const [latest, prev] = (recent ?? []) as unknown as Latest[];

  const form = (
    <form action={saveClient} className="flex flex-col gap-3">
      {!isNew && <input type="hidden" name="id" value={id} />}
      <label className="label">회사명 *<input name="name" required defaultValue={c?.name} className="input" /></label>
      <label className="label">담당자<input name="contact_name" defaultValue={c?.contact_name ?? ""} className="input" /></label>
      <label className="label">연락처<input name="phone" type="tel" defaultValue={c?.phone ?? ""} className="input" /></label>
      <label className="label">주소<input name="address" defaultValue={c?.address ?? ""} className="input" /></label>
      <Submit label="저장" />
    </form>
  );

  return (
    <Page title={isNew ? "새 거래처" : c!.name} back="/clients" error={sp.error as string | undefined}>
      {isNew ? form : (
        <>
          {machines.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {machines.map((m) => (
                <Link key={m.id} href={`/clients/${id}?m=${m.id}`} replace
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${m.id === sel?.id ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"} ${m.active ? "" : "opacity-50"}`}>
                  {m.serial}
                </Link>
              ))}
            </div>
          )}
          {sel ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg font-bold">{sel.serial} <span className="text-sm font-normal text-gray-500">{sel.color_type === "color" ? "컬러" : "흑백"} · {sel.model}{sel.active ? "" : " · 사용 안 함"}</span></p>
                <Link href={`/machines/${sel.id}`} className="shrink-0 text-sm text-gray-500">기계 정보 ›</Link>
              </div>
              <Consumables machine={{ id: sel.id, serial: sel.serial, model: sel.model, color: sel.color_type === "color" }} latest={latest} prev={prev} />
            </>
          ) : <p className="card text-sm text-gray-500">등록된 기계가 없습니다.</p>}

          <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4">
            <Link href={`/machines/new?client=${id}`} className="btn-outline text-center text-sm font-semibold">+ 기계 추가</Link>
            <details>
              <summary className="text-sm text-gray-500">거래처 정보 수정 (담당자 · 연락처 · 주소)</summary>
              <div className="mt-3">{form}</div>
            </details>
          </div>
        </>
      )}
    </Page>
  );
}
