"use server";

import { createClient, getMe } from "@/lib/supabase/server";

export type Recognized = {
  serial: string | null; mono_counter: number | null; color_counter: number | null;
  items: { id: number; percent: number | null; status: string | null }[];
};
type Raw = { serial?: unknown; mono_counter?: unknown; color_counter?: unknown; items?: { id?: unknown; percent?: unknown; status?: unknown }[] };

// 무료 한도가 모델별로 따로라, 앞 모델이 한도 초과·오류면 다음 모델로
const MODELS = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash-lite"];
// shortcut: 후지 "사용 매수 1~4"는 1=칼라, 2=흑백으로 가정 (사용자 확인 전). 반대면 이 줄만 바꿀 것
const FUJI = "1=칼라, 2=흑백";

const int = (v: unknown, max = Number.MAX_SAFE_INTEGER) => {
  const n = typeof v === "string" ? Number(v.replace(/[,\s%]/g, "")) : v;
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max ? (n as number) : null;
};
const text = (v: unknown, len: number) => (typeof v === "string" ? v.trim().slice(0, len) || null : null);

// 사진을 Gemini(무료)로 읽어 입력칸 채울 값을 돌려줌. 실패하면 { error } → 직접 입력
export async function recognizePhotos(machineId: number, paths: string[]): Promise<Recognized | { error: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: "자동 읽기가 꺼져 있습니다." };
  if (!(await getMe())) return { error: "로그인이 필요합니다." };
  paths = paths.filter((p) => p.startsWith(`${machineId}/`)).slice(0, 4);

  const supabase = await createClient();
  const { data: m } = await supabase.from("machines").select("color_type").eq("id", machineId).single();
  if (!m || !paths.length) return { error: "기계나 사진을 찾을 수 없습니다." };
  const [{ data: types }, files] = await Promise.all([
    supabase.from("consumable_types").select("id, name").eq("applies_to", m.color_type).eq("active", true).order("sort"),
    Promise.all(paths.map((p) => supabase.storage.from("inspection-photos").download(p))),
  ]);
  const images = await Promise.all(files.flatMap((f) => (f.data ? [f.data.arrayBuffer()] : [])));
  const ids = new Set((types ?? []).map((t) => t.id));

  const prompt = [
    `복사기 화면 사진입니다 (${m.color_type === "color" ? "컬러기" : "흑백기"}). 사진에 보이는 값만 읽어 JSON 하나로만 답하세요. 안 보이거나 확실하지 않은 값은 null.`,
    `형식: {"serial": 문자열|null, "mono_counter": 정수|null, "color_counter": 정수|null, "items": [{"id": 소모품번호, "percent": 0~100 정수|null, "status": 문자열|null}]}`,
    `- serial: 화면에 보이는 기계번호(보통 6자리 숫자).`,
    `- 카운터: 흑백·칼라 누적 사용 매수. "흑백 임프레션"/"컬러 임프레션" 값을 쓰고 "총", "컬러 큰 크기"는 쓰지 않음. 후지 "사용 매수 1~4" 화면은 ${FUJI} (4는 합계라 안 씀). 흑백기는 흑백 매수만 mono_counter에.`,
    `- items: 아래 목록 중 사진에 보이는 소모품만. 토너 K/C/M/Y = 검정/청록/자홍/노랑. 토너회수통은 R5로 나오기도 함. status는 "양호", "소모품교체준비"처럼 화면에 적힌 글자 그대로, %만 있으면 null.`,
    ...(types ?? []).map((t) => `  ${t.id}: ${t.name}`),
  ].join("\n");

  let lastError = "";
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            ...images.map((b) => ({ inline_data: { mime_type: "image/jpeg", data: Buffer.from(b).toString("base64") } })),
            { text: prompt },
          ] }],
          generationConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "low" } },
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        lastError = res.status === 429 ? "오늘 무료 한도 초과" : `오류 ${res.status}`;
        console.error("gemini", model, res.status, await res.text());
        continue;
      }
      const json = await res.json();
      const out = (json.candidates?.[0]?.content?.parts ?? [])
        .filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("");
      const r = JSON.parse(out) as Raw;
      return {
        serial: text(r.serial, 30)?.toUpperCase() ?? null,
        mono_counter: int(r.mono_counter),
        color_counter: int(r.color_counter),
        items: (Array.isArray(r.items) ? r.items : [])
          .filter((i) => ids.has(i?.id as number))
          .map((i) => ({ id: i.id as number, percent: int(i.percent, 100), status: text(i.status, 20) })),
      };
    } catch (e) {
      lastError = e instanceof Error && e.name === "TimeoutError" ? "응답 지연" : "응답을 읽지 못함";
      console.error("gemini", model, e);
    }
  }
  return { error: `자동 읽기 실패(${lastError}) — 직접 입력해 주세요.` };
}
