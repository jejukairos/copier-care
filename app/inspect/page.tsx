import Link from "next/link";
import { Page, requireMe } from "@/lib/page";
import { createClient } from "@/lib/supabase/server";
import { InspectForm, type Last } from "./form";
import { MachineSearch } from "./search";

type M = { id: number; serial: string; model: string; color_type: string; clients: { name: string } | null };

// /inspect?q=기계번호 → 한 대로 정해지면 사진·소모품 입력, 아니면 후보 목록
export default async function InspectPage({ searchParams }: PageProps<"/inspect">) {
  await requireMe();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().toUpperCase();
  const error = sp.error as string | undefined;
  const supabase = await createClient();

  // shortcut: 사용 중인 기계 전체를 받아 걸러냄. 수천 대가 넘으면 DB 검색(ilike)으로 바꿀 것
  const { data } = await supabase.from("machines").select("id, serial, model, color_type, clients(name)").eq("active", true).order("serial");
  const all = (data ?? []) as unknown as M[];
  const exact = all.filter((m) => m.serial.toUpperCase() === q);
  const hits = exact.length ? exact
    : q ? all.filter((m) => m.serial.toUpperCase().includes(q) || m.clients?.name.toUpperCase().includes(q)) : [];

  if (hits.length !== 1) {
    return (
      <Page title="사진 올리기" back="/" error={error}>
        <MachineSearch machines={all} q={q} />
        {q && hits.length === 0 && (
          <p className="card text-sm text-gray-600">
            &apos;{q}&apos; 기계를 찾지 못했습니다. <Link href="/clients" className="text-blue-600">거래처 · 기계</Link>에서 먼저 등록하세요.
          </p>
        )}
        {hits.map((m) => (
          <Link key={m.id} href={`/inspect?q=${encodeURIComponent(m.serial)}`} className="card flex justify-between gap-2 active:bg-gray-50">
            <span className="font-semibold">{m.serial}</span>
            <span className="text-sm text-gray-500">{m.clients?.name} · {m.model}</span>
          </Link>
        ))}
      </Page>
    );
  }

  const m = hits[0];
  const [{ data: types }, { data: last }, { data: staff }] = await Promise.all([
    supabase.from("consumable_types").select("id, name, is_main").eq("applies_to", m.color_type).eq("active", true).order("sort"),
    supabase.from("inspections")
      .select("inspected_on, mono_counter, color_counter, consumable_readings(consumable_type_id, percent, status)")
      .eq("machine_id", m.id).order("inspected_on", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("staff").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <Page title={m.serial} back="/" error={error}>
      <p className="-mt-2 text-sm text-gray-600">{m.clients?.name} · {m.model}</p>
      <InspectForm
        machine={{ id: m.id, serial: m.serial, color: m.color_type === "color" }}
        types={types ?? []} last={last as Last} staff={staff ?? []}
        today={new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })}
      />
    </Page>
  );
}
