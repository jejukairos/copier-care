-- 소모품 화면의 "양호", "소모품교체준비" 같은 상태값도 저장 (%가 없는 항목도 있음)
alter table public.consumable_readings alter column percent drop not null;
alter table public.consumable_readings add column status text;
