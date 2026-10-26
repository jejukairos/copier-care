import Link from "next/link";
import { notFound } from "next/navigation";
import { Page, requireMe } from "@/lib/page";
import { createClient } from "@/lib/supabase/server";
import { saveClient } from "../actions";

// /clients/new 도 이 화면 (id = "new")
export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  await requireMe();
  const { id } = await params;
  const { error } = await searchParams;
  const isNew = id === "new";
  const supabase = await createClient();

  const { data: c } = isNew
    ? { data: null }
    : await supabase.from("clients")
        .select("*, machines(id, serial, model, color_type, active)")
        .eq("id", id).single();
  if (!isNew && !c) notFound();

  return (
    <Page title={isNew ? "새 거래처" : c!.name} back="/clients" error={error as string | undefined}>
      <form action={saveClient} className="flex flex-col gap-3">
        {!isNew && <input type="hidden" name="id" value={id} />}
        <label className="label">회사명 *<input name="name" required defaultValue={c?.name} className="input" /></label>
        <label className="label">담당자<input name="contact_name" defaultValue={c?.contact_name ?? ""} className="input" /></label>
        <label className="label">연락처<input name="phone" type="tel" defaultValue={c?.phone ?? ""} className="input" /></label>
        <label className="label">주소<input name="address" defaultValue={c?.address ?? ""} className="input" /></label>
        <button className="btn">저장</button>
      </form>

      {!isNew && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">기계</h2>
            <Link href={`/machines/new?client=${id}`} className="btn py-2 text-sm">+ 기계</Link>
          </div>
          {c!.machines.map((m: { id: number; serial: string; model: string; color_type: string; active: boolean }) => (
            <Link key={m.id} href={`/machines/${m.id}`} className={`card block active:bg-gray-50 ${m.active ? "" : "opacity-50"}`}>
              <p className="font-semibold">{m.serial} <span className="text-sm font-normal text-gray-500">{m.color_type === "color" ? "컬러" : "흑백"}</span></p>
              <p className="text-sm text-gray-500">{m.model}{m.active ? "" : " · 사용 안 함"}</p>
            </Link>
          ))}
          {c!.machines.length === 0 && <p className="text-sm text-gray-500">등록된 기계가 없습니다.</p>}
        </section>
      )}
    </Page>
  );
}
