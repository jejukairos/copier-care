import Link from "next/link";
import { Page, requireMe } from "@/lib/page";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

type Reading = { percent: number; consumable_types: { name: string; sort: number } | null };
type Row = {
  id: number; serial: string; model: string;
  clients: { name: string } | null;
  inspections: { inspected_on: string; consumable_readings: Reading[] }[];
};

export default async function Home() {
  const { profile, user, isAdmin } = await requireMe();

  if (profile?.active === false) {
    return <Page title="정기점검 관리"><p className="rounded-lg bg-red-50 p-4 text-red-700">사용이 중지된 계정입니다. 관리자에게 문의하세요.</p></Page>;
  }

  const supabase = await createClient();
  const [{ data: settings }, { data: machines }] = await Promise.all([
    supabase.from("app_settings").select("key, value").in("key", ["urgent_percent", "warning_percent"]),
    supabase.from("machines")
      .select("id, serial, model, clients(name), inspections(inspected_on, consumable_readings(percent, consumable_types(name, sort)))")
      .eq("active", true)
      .order("inspected_on", { referencedTable: "inspections", ascending: false })
      .limit(1, { referencedTable: "inspections" }),
  ]);
  const setting = (k: string, d: number) => Number(settings?.find((s) => s.key === k)?.value ?? d);
  const urgent = setting("urgent_percent", 10);
  const warning = setting("warning_percent", 20);

  // 기계별 가장 최근 점검의 소모품 중 주의 이하만, 가장 급한 기계부터
  const alerts = ((machines ?? []) as unknown as Row[])
    .map((m) => {
      const last = m.inspections[0];
      const items = (last?.consumable_readings ?? [])
        .filter((r) => r.percent <= warning)
        .toSorted((a, b) => a.percent - b.percent);
      return { ...m, last, items };
    })
    .filter((m) => m.items.length > 0)
    .toSorted((a, b) => a.items[0].percent - b.items[0].percent);

  const menu = [
    { href: "/clients", icon: "🏢", label: "거래처 · 기계" },
    ...(isAdmin ? [
      { href: "/staff", icon: "👤", label: "직원 명단" },
      { href: "/settings/items", icon: "⚙️", label: "소모품 · 부품 항목" },
    ] : []),
  ];

  return (
    <Page
      title="정기점검 관리"
      right={<form action={signOut}><button className="rounded-lg border border-gray-300 px-3 py-2 text-sm">로그아웃</button></form>}
    >
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">⚠️ 조치요망</h2>
          <p className="text-xs text-gray-500">
            <span className="text-red-600">● 긴급 {urgent}% 이하</span> · <span className="text-orange-500">● 주의 {warning}% 이하</span>
          </p>
        </div>
        {alerts.length === 0 && <p className="card text-sm text-gray-500">조치할 소모품이 없습니다 ✓</p>}
        {alerts.map((m) => (
          <Link key={m.id} href={`/machines/${m.id}`} className="card flex flex-col gap-2 active:bg-gray-50">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{m.clients?.name}</p>
              <p className="shrink-0 text-xs text-gray-500">{m.serial} · {m.last.inspected_on.slice(5).replace("-", "/")} 점검</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.items.map((r) => (
                <span key={r.consumable_types?.name}
                  className={`rounded-full px-2.5 py-1 text-sm font-semibold ${r.percent <= urgent ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                  {r.consumable_types?.name} {r.percent}%
                </span>
              ))}
            </div>
          </Link>
        ))}
      </section>

      <nav className="grid grid-cols-2 gap-2">
        {menu.map((m) => (
          <Link key={m.href} href={m.href} className="card flex items-center gap-2 py-3 active:bg-gray-50">
            <span className="text-xl">{m.icon}</span>
            <span className="text-sm font-semibold">{m.label}</span>
          </Link>
        ))}
      </nav>
      <p className="text-center text-xs text-gray-400">{profile?.name ?? user.email} · {isAdmin ? "관리자" : "직원"}</p>
    </Page>
  );
}
