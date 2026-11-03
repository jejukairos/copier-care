-- 흑백·칼라 외 카운터(큰 크기, 합계, 복사/프린트/팩스 등)를 {"칸 이름": 숫자}로 저장
alter table public.inspections add column extra_counters jsonb;
