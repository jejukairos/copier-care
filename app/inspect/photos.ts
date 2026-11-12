import { createClient } from "@/lib/supabase/client";

export type Photo = { url: string; path: string };

// 휴대폰 사진(수 MB)을 긴 변 1600px JPEG로 줄임 → 약 200~300KB, 카운터 숫자는 읽힐 정도
async function shrink(file: File) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("사진 변환 실패"))), "image/jpeg", 0.75));
}

// 사진은 서버를 거치지 않고 Supabase Storage로 바로 올림 (Netlify 사용량 절약). folder = 기계 id, 아직 없는 새 기계는 "new"
// shortcut: 올린 뒤 저장 안 하고 나가면 사진이 저장소에 남음, 용량이 문제 되면 정리 기능에서 같이 지울 것
export async function uploadPhoto(file: File, folder: number | "new"): Promise<Photo> {
  const blob = await shrink(file);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await createClient().storage.from("inspection-photos").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return { url: URL.createObjectURL(blob), path };
}

// 새 기계 화면에서 올린 사진 경로 (서버에서 받을 때 검사용)
export const NEW_PHOTO = /^new\/[\w.-]+\.jpg$/;
