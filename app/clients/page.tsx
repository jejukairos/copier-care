import Link from "next/link";
import { Page, requireMe } from "@/lib/page";
import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  await requireMe();
  const q = String((await searchParams).q ?? "").trim();
  const supabase = await createClient();

  // 회사명 또는 기계번호 부분 일치
  let clientIds: number[] | null = null;
  if (q) {
    const { data: ms } = await supabase.from("machines").select("client_id").ilike("serial", `%${q}%`);
    clientIds = (ms ?? []).map((m) => m.client_id);
  }
  let query = supabase.from("clients").select("id, name, contact_name, machines(serial, active)").order("name");
  if (q) {
    const like = `name.ilike.%${q.replace(/[,()]/g, "")}%`;
    query = query.or(clientIds?.length ? `${like},id.in.(${clientIds.join(",")})` : like);
  }
  const { data: clients } = await query;

  return (
    <Page title="거래처 · 기계" back="/" right={<Link href="/clients/new" className="btn py-2 text-sm">+ 거래처</Link>}>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="회사명 또는 기계번호" className="input" />
        <button className="btn-outline shrink-0">검색</button>
      </form>
      <ul className="flex flex-col gap-2">
        {clients?.map((c) => (
          <li key={c.id}>
            <Link href={`/clients/${c.id}`} className="card block active:bg-gray-50">
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-gray-500">
                {c.machines.filter((m) => m.active).map((m) => m.serial).join(", ") || "등록된 기계 없음"}
              </p>
            </Link>
          </li>
        ))}
        {clients?.length === 0 && <p className="py-8 text-center text-gray-500">검색 결과가 없습니다.</p>}
      </ul>
    </Page>
  );
}
