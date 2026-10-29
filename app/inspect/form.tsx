"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { saveInspection } from "./actions";
import { recognizePhotos, type Recognized } from "./recognize";

type Type = { id: number; name: string; is_main: boolean };
type Reading = { consumable_type_id: number; percent: number | null; status: string | null };
export type Last = { inspected_on: string; mono_counter: number | null; color_counter: number | null; consumable_readings: Reading[] } | null;

// 휴대폰 사진(수 MB)을 긴 변 1600px JPEG로 줄임 → 약 200~300KB, 카운터 숫자는 읽힐 정도
async function shrink(file: File) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("사진 변환 실패"))), "image/jpeg", 0.75));
}

const photoPath = (machineId: number) => `${machineId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

function SaveButton({ uploading }: { uploading: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={uploading || pending} className="btn">{pending ? "저장 중…" : uploading ? "사진 올리는 중…" : "저장"}</button>;
}

export function InspectForm({ machine, types, last, staff, today, ai }: {
  machine: { id: number; serial: string; color: boolean }; types: Type[]; last: Last; staff: { id: number; name: string }[]; today: string; ai: boolean;
}) {
  const [photos, setPhotos] = useState<{ url: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(0);
  const [photoError, setPhotoError] = useState("");
  const [aiNote, setAiNote] = useState("");
  const inspector = useRef<HTMLSelectElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const prev = new Map(last?.consumable_readings.map((r) => [r.consumable_type_id, r]));

  // 이 휴대폰에서 마지막으로 고른 점검자를 기본값으로
  useEffect(() => {
    try {
      const v = localStorage.getItem("inspector");
      const sel = inspector.current;
      if (v && sel && [...sel.options].some((o) => o.value === v)) sel.value = v;
    } catch {}
  }, []);

  // 사진은 서버를 거치지 않고 Supabase Storage로 바로 올림 (Netlify 사용량 절약)
  // shortcut: 올린 뒤 저장 안 하고 나가면 사진이 저장소에 남음, 용량이 문제 되면 정리 기능에서 같이 지울 것
  async function addPhotos(files: File[]) {
    setPhotoError("");
    const supabase = createClient();
    const added: string[] = [];
    for (const file of files) {
      setUploading((n) => n + 1);
      try {
        const blob = await shrink(file);
        const path = photoPath(machine.id);
        const { error } = await supabase.storage.from("inspection-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        setPhotos((p) => [...p, { url: URL.createObjectURL(blob), path }]);
        added.push(path);
      } catch (e) {
        setPhotoError("사진 올리기 실패: " + (e instanceof Error ? e.message : String(e)));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (ai && added.length) await readPhotos(added);
  }

  // 자동으로 읽은 값은 비어 있는 칸에만 넣고 노란색 표시 (직접 적은 값은 안 건드림)
  async function readPhotos(paths: string[]) {
    setAiNote("🔍 사진 읽는 중…");
    const r: Recognized | { error: string } = await recognizePhotos(machine.id, paths).catch(() => ({ error: "자동 읽기 실패 — 직접 입력해 주세요." }));
    if ("error" in r) return setAiNote(r.error);
    let filled = 0;
    const put = (name: string, v: number | string | null) => {
      const el = formRef.current?.elements.namedItem(name);
      if (v === null || !(el instanceof HTMLInputElement) || el.value) return;
      el.value = String(v);
      el.classList.add("bg-yellow-100");
      el.closest("details")?.setAttribute("open", "");
      filled++;
    };
    put("mono_counter", r.mono_counter);
    put("color_counter", r.color_counter);
    r.items.forEach((i) => { put(`p_${i.id}`, i.percent); put(`s_${i.id}`, i.status); });
    const other = r.serial && r.serial !== machine.serial.toUpperCase() ? ` ⚠️ 사진 속 기계번호 ${r.serial}가 ${machine.serial}와 다릅니다!` : "";
    setAiNote((filled ? `✓ ${filled}칸 자동 입력 (노란 칸). 사진과 맞는지 확인 후 저장하세요.` : "읽은 값이 없습니다. 직접 입력해 주세요.") + other);
  }

  // 서버에서 막히면 입력한 값이 다 날아가므로 카운터 감소는 여기서 먼저 확인
  function check(e: React.FormEvent<HTMLFormElement>) {
    const f = new FormData(e.currentTarget);
    const down = (k: "mono_counter" | "color_counter") => {
      const v = String(f.get(k) ?? "").replace(/,/g, "");
      return v !== "" && last?.[k] != null && Number(v) < last[k];
    };
    if ((down("mono_counter") || down("color_counter")) && !String(f.get("memo") ?? "").trim()) {
      e.preventDefault();
      alert("카운터가 지난번보다 작습니다. 이유를 메모에 적어주세요.");
      return;
    }
    try { localStorage.setItem("inspector", String(f.get("inspector_id") ?? "")); } catch {}
  }

  const row = (t: Type) => {
    const p = prev.get(t.id);
    return (
      <div key={t.id} className="grid grid-cols-[5.5rem_4.5rem_1fr] items-center gap-2">
        <span className="text-sm font-semibold">{t.name}</span>
        <input name={`p_${t.id}`} type="number" inputMode="numeric" min={0} max={100} aria-label={`${t.name} %`}
          placeholder={p?.percent != null ? `${p.percent}%` : "%"} className="input px-2" />
        <input name={`s_${t.id}`} aria-label={`${t.name} 상태`} placeholder={p?.status ?? "양호 등"} className="input px-2" />
      </div>
    );
  };
  const main = types.filter((t) => t.is_main);
  const extra = types.filter((t) => !t.is_main);
  const fmt = (n: number | null | undefined) => n?.toLocaleString("ko-KR") ?? "";

  return (
    <form ref={formRef} action={saveInspection} onSubmit={check} className="flex flex-col gap-4">
      <input type="hidden" name="machine_id" value={machine.id} />
      <input type="hidden" name="serial" value={machine.serial} />
      {photos.map((p) => <input key={p.path} type="hidden" name="photo" value={p.path} />)}

      <section className="flex flex-col gap-2">
        {photos.map((p) => (
          <a key={p.path} href={p.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- 방금 찍은 사진(blob) 미리보기 */}
            <img src={p.url} alt="올린 사진" className="w-full rounded-lg border border-gray-200" />
          </a>
        ))}
        <label className="btn-outline cursor-pointer font-semibold">
          📷 사진 추가 (카운터 · 소모품 화면)
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; addPhotos(files); }} />
        </label>
        {photos.length > 0 && <p className="text-xs text-gray-400">사진을 누르면 크게 볼 수 있어요</p>}
        {uploading > 0 && <p className="text-sm text-blue-600">사진 올리는 중… ({uploading}장)</p>}
        {photoError && <p className="text-sm text-red-600">{photoError}</p>}
        {aiNote && <p className="rounded-lg bg-yellow-50 p-2 text-sm text-gray-700">{aiNote}</p>}
      </section>

      <section className="card flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">소모품</h2>
          <p className="text-xs text-gray-400">회색 글씨 = 지난번{last && ` (${last.inspected_on.slice(5).replace("-", "/")})`}</p>
        </div>
        {main.map(row)}
        {extra.length > 0 && (
          <details>
            <summary className="text-sm text-blue-600">그 외 항목 ({extra.map((t) => t.name).join(", ")})</summary>
            <div className="mt-2 flex flex-col gap-2">{extra.map(row)}</div>
          </details>
        )}
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="font-semibold">사용 매수 (카운터)</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">흑백<input name="mono_counter" inputMode="numeric" placeholder={fmt(last?.mono_counter)} className="input" /></label>
          {machine.color && <label className="label">칼라<input name="color_counter" inputMode="numeric" placeholder={fmt(last?.color_counter)} className="input" /></label>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <label className="label">점검일<input name="inspected_on" type="date" required defaultValue={today} className="input" /></label>
        <label className="label">구분
          <select name="kind" className="input">
            <option value="regular">정기점검</option>
            <option value="visit">수시방문</option>
          </select>
        </label>
      </div>
      <label className="label">점검자
        <select ref={inspector} name="inspector_id" className="input">
          <option value="">선택 안 함</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="label">메모<textarea name="memo" rows={2} className="input" /></label>
      <SaveButton uploading={uploading > 0} />
    </form>
  );
}
