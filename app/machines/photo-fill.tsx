"use client";

import { useRef, useState } from "react";
import { uploadPhoto, type Photo } from "../inspect/photos";
import { recognizeMachine } from "../inspect/recognize";

// 새 기계 화면 맨 위: 카운터·소모품 사진을 올리면 기계번호·컬러/흑백(·기종)을 채움.
// 저장하면 이 사진들을 들고 소모품 입력 화면으로 넘어가 카운터·소모품도 자동으로 읽음
export function PhotoFill({ ai }: { ai: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  async function add(files: File[]) {
    setNote(`사진 올리는 중… (${files.length}장)`);
    let up: Photo[];
    try {
      up = await Promise.all(files.slice(0, 4).map((f) => uploadPhoto(f, "new")));
    } catch (e) {
      return setNote("사진 올리기 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setPhotos((p) => [...p, ...up]);
    if (!ai) return setNote("기계번호·기종을 적고 저장하면 다음 화면에서 소모품을 입력해요.");

    setNote("🔍 사진 읽는 중…");
    const r = await recognizeMachine(up.map((p) => p.path)).catch(() => ({ error: "자동 읽기 실패 — 직접 입력해 주세요." }));
    if ("error" in r) return setNote(r.error);
    const form = ref.current?.closest("form");
    const put = (name: string, v: string | null) => {
      const el = form?.elements.namedItem(name);
      if (v === null || !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return false;
      el.value = v;
      el.classList.add("bg-yellow-100");
      return true;
    };
    const got = [put("serial", r.serial) && "기계번호", put("model", r.model) && "기종", put("color_type", r.color === null ? null : r.color ? "color" : "mono") && "구분"].filter(Boolean);
    setNote((got.length ? `✓ ${got.join("·")} 자동 입력 (노란 칸). 확인하세요.` : "기계번호를 읽지 못했어요.")
      + `${r.model ? "" : " 기종은 직접 적어 주세요."} 저장하면 다음 화면에서 카운터·소모품을 자동으로 읽어요.`);
  }

  return (
    <div ref={ref} className="card flex flex-col gap-2 border-blue-200 bg-blue-50">
      {photos.map((p) => <input key={p.path} type="hidden" name="photo" value={p.path} />)}
      <label className="btn-outline cursor-pointer bg-white font-semibold">
        📷 사진으로 등록 (카운터 · 소모품 화면)
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; if (files.length) add(files); }} />
      </label>
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- 방금 찍은 사진(blob) 미리보기 */}
          {photos.map((p) => <img key={p.path} src={p.url} alt="올린 사진" className="aspect-square w-full rounded object-cover" />)}
        </div>
      )}
      {note && <p className="text-sm text-gray-700">{note}</p>}
    </div>
  );
}
