import Link from "next/link";
import { notFound } from "next/navigation";
import { Page, requireMe } from "@/lib/page";
import { createClient } from "@/lib/supabase/server";
import { addPartReplacement, deletePartReplacement, saveMachine } from "../actions";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const won = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR");
type Contract = { starts_on: string; base_mono: number; base_color: number; monthly_fee: number; over_mono_price: number; over_color_price: number };
type Latest = {
  inspected_on: string; mono_usage: number | null; color_usage: number | null;
  consumable_readings: { percent: number | null; status: string | null; consumable_types: { name: string; sort: number } | null }[];
};
type Replacement ={ id: number; replaced_on: string; counter_at: number | null; memo: string | null; part_types: { name: string } | null; staff: { name: string } | null };

// /machines/new?client=ID 도 이 화면
export default async function MachinePage({ params, searchParams }: PageProps<"/machines/[id]">) {
  const { isAdmin } = await requireMe();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const supabase = await createClient();

  const [{ data: m }, { data: clients }, { data: staff }] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : supabase.from("machines")
      .select("*, clients(name), contracts(*), part_replacements(*, part_types(name), staff(name)), inspections(inspected_on, mono_usage, color_usage, consumable_readings(percent, status, consumable_types(name, sort)))")
      .eq("id", id)
      .order("inspected_on", { referencedTable: "inspections", ascending: false })
      .limit(1, { referencedTable: "inspections" })
      .single(),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("staff").select("id, name").eq("active", true).order("name"),
  ]);
  if (!isNew && !m) notFound();

  const clientId = m?.client_id ?? Number(sp.client);
  const contract = (m?.contracts as Contract[] | undefined)?.toSorted((a, b) => b.starts_on.localeCompare(a.starts_on))[0];
  const colorType = m?.color_type ?? "color";

  const { data: partTypes } = isNew ? { data: [] } : await supabase.from("part_types")
    .select("id, name, applies_to, tray_no").eq("active", true).order("sort");
  const parts = (partTypes ?? []).filter((p) =>
    (p.applies_to === "both" || p.applies_to === colorType) && (p.tray_no === null || p.tray_no <= m!.tray_count));
  const history = ((m?.part_replacements ?? []) as Replacement[]).toSorted((a, b) => b.replaced_on.localeCompare(a.replaced_on));
  const latest = (m?.inspections as Latest[] | undefined)?.[0];
  const readings = (latest?.consumable_readings ?? []).toSorted((a, b) => (a.consumable_types?.sort ?? 0) - (b.consumable_types?.sort ?? 0));

  return (
    <Page
      title={isNew ? "새 기계" : m!.serial}
      back={clientId ? `/clients/${clientId}` : "/clients"}
      error={sp.error as string | undefined}
    >
      {sp.saved && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">저장했습니다.</p>}

      {!isNew && (
        <section className="card flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">최근 소모품{latest && ` · ${latest.inspected_on}`}</h2>
            <Link href={`/inspect?q=${encodeURIComponent(m!.serial)}`} className="shrink-0 text-sm font-semibold text-blue-600">📷 사진 올리기</Link>
          </div>
          {readings.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {readings.map((r) => (
                <span key={r.consumable_types?.name} className="rounded-full bg-gray-100 px-2.5 py-1 text-sm">
                  {r.consumable_types?.name}{r.percent !== null && ` ${r.percent}%`}{r.status && ` ${r.status}`}
                </span>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">소모품 기록이 없습니다.</p>}
          {latest?.mono_usage != null && (
            <p className="text-sm text-gray-600">
              지난 정기점검 대비 흑백 {won(latest.mono_usage)}매{latest.color_usage != null && ` · 칼라 ${won(latest.color_usage)}매`} 사용
            </p>
          )}
        </section>
      )}

      <form action={saveMachine} className="flex flex-col gap-3">
        {!isNew && <input type="hidden" name="id" value={id} />}
        <label className="label">기계번호 *<input name="serial" required defaultValue={m?.serial} className="input uppercase" /></label>
        <label className="label">거래처 *
          <select name="client_id" required defaultValue={clientId || ""} className="input">
            <option value="" disabled>선택</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="label">기종 *<input name="model" required defaultValue={m?.model} className="input" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">구분
            <select name="color_type" defaultValue={colorType} className="input">
              <option value="color">컬러</option>
              <option value="mono">흑백</option>
            </select>
          </label>
          <label className="label">트레이 수
            <select name="tray_count" defaultValue={m?.tray_count ?? 2} className="input">
              {[2, 3, 4].map((n) => <option key={n} value={n}>{n}개</option>)}
            </select>
          </label>
          <label className="label">설치일<input name="installed_on" type="date" defaultValue={m?.installed_on ?? ""} className="input" /></label>
          <label className="label">점검일 (매월)
            <select name="inspection_day" defaultValue={m?.inspection_day ?? ""} className="input">
              <option value="">미정</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}일</option>)}
            </select>
          </label>
        </div>
        <label className="label">담당 직원
          <select name="staff_id" defaultValue={m?.staff_id ?? ""} className="input">
            <option value="">없음</option>
            {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="label">메모<textarea name="memo" defaultValue={m?.memo ?? ""} rows={2} className="input" /></label>
        {!isNew && (
          <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={m!.active} className="size-5" /> 사용 중 (회수한 기계는 해제)</label>
        )}

        {isAdmin ? (
          <fieldset className="card flex flex-col gap-3">
            <legend className="px-1 font-semibold">계약 조건</legend>
            <label className="label">적용 시작일 (단가가 바뀌면 새 날짜로 저장 → 이력 유지)
              <input name="starts_on" type="date" required defaultValue={contract?.starts_on ?? today()} className="input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="label">기본 흑백매수<input name="base_mono" inputMode="numeric" defaultValue={contract?.base_mono ?? ""} className="input" /></label>
              <label className="label">기본 칼라매수<input name="base_color" inputMode="numeric" defaultValue={contract?.base_color ?? ""} className="input" /></label>
              <label className="label">초과 흑백 단가<input name="over_mono_price" inputMode="decimal" defaultValue={contract?.over_mono_price ?? ""} className="input" /></label>
              <label className="label">초과 칼라 단가<input name="over_color_price" inputMode="decimal" defaultValue={contract?.over_color_price ?? ""} className="input" /></label>
            </div>
            <label className="label">월 기본료 (원)<input name="monthly_fee" inputMode="numeric" defaultValue={contract?.monthly_fee ?? ""} className="input" /></label>
          </fieldset>
        ) : contract && (
          <div className="card text-sm text-gray-600">
            <p className="font-semibold text-gray-900">계약 조건</p>
            <p>기본 흑백 {won(contract.base_mono)}매 · 칼라 {won(contract.base_color)}매</p>
            <p>월 기본료 {won(contract.monthly_fee)}원</p>
          </div>
        )}
        <button className="btn">저장</button>
      </form>

      {!isNew && (
        <section id="parts" className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">부품 교체이력</h2>
          <details className="card">
            <summary className="font-semibold text-blue-600">+ 교체 기록 추가</summary>
            <form action={addPartReplacement} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="machine_id" value={id} />
              <label className="label">부품
                <select name="part_type_id" required className="input">
                  {parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="label">교체일<input name="replaced_on" type="date" required defaultValue={today()} className="input" /></label>
                <label className="label">교체 시점 카운터<input name="counter_at" inputMode="numeric" className="input" /></label>
              </div>
              <label className="label">교체자
                <select name="replaced_by" className="input">
                  <option value="">선택 안 함</option>
                  {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="label">메모<input name="memo" className="input" /></label>
              <button className="btn">기록</button>
            </form>
          </details>
          {history.map((h) => (
            <div key={h.id} className="card flex items-start justify-between gap-2 text-sm">
              <div>
                <p className="font-semibold">{h.part_types?.name}</p>
                <p className="text-gray-500">
                  {h.replaced_on}{h.counter_at != null && ` · ${won(h.counter_at)}매`}{h.staff?.name && ` · ${h.staff.name}`}
                </p>
                {h.memo && <p className="text-gray-600">{h.memo}</p>}
              </div>
              {isAdmin && (
                <form action={deletePartReplacement}>
                  <input type="hidden" name="machine_id" value={id} />
                  <input type="hidden" name="id" value={h.id} />
                  <button className="text-red-600">삭제</button>
                </form>
              )}
            </div>
          ))}
          {history.length === 0 && <p className="text-sm text-gray-500">교체 기록이 없습니다.</p>}
        </section>
      )}
      {isNew && !clientId && <Link href="/clients" className="text-sm text-blue-600">거래처를 먼저 등록하세요</Link>}
    </Page>
  );
}
