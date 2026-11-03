// 기종마다 카운터 화면이 달라서, 흑백/칼라 사용 매수로 쓸 항목 + 나머지 칸 이름 (사용자 확인 2026-11-02). 새 기종은 여기에 한 줄 추가
const GUIDE: { match: RegExp; models: string; mono: string; color?: string; extra: string[] }[] = [
  { match: /^APV/i, models: "APVIC3371, APVIIC3373", mono: "합계(흑백)", color: "합계(컬러)", extra: ["큰 크기의 컬러", "합계"] },
  { match: /^APC/i, models: "APC2060·2560·3060", mono: "흑백 임프레션", color: "컬러 임프레션", extra: ["큰 크기의 컬러", "총 임프레션"] },
  { match: /^AC/i, models: "AC2060·2560·3060", mono: "흑백 임프레션", color: "컬러 임프레션", extra: ["컬러 큰 크기 임프레션", "총 임프레션"] },
  { match: /^DCSC/i, models: "DCSC2020", mono: "사용 매수 2", color: "사용 매수 1", extra: ["사용 매수 3(A3)", "사용 매수 4(합계)"] },
  { match: /^AP\d/i, models: "AP2560·3060·3560 (흑백기)", mono: "총 임프레션", extra: ["복사", "프린트", "팩스"] },
];

export const counterGuide = (model: string) => GUIDE.find((g) => g.match.test(model.replace(/\s/g, "")));

// 흑백·칼라 외 나머지 카운터 칸 (모르는 기종은 큰 크기·합계)
export const extraCounters = (model: string, color: boolean) =>
  counterGuide(model)?.extra ?? (color ? ["큰 크기(A3)", "합계"] : ["합계"]);

export const COUNTER_RULES = GUIDE.map((g) =>
  `  ${g.models}: 흑백="${g.mono}"${g.color ? `, 칼라="${g.color}"` : ""}, 나머지=${g.extra.map((x) => `"${x}"`).join(", ")}`).join("\n");
