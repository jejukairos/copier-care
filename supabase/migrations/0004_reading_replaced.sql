-- 점검 때 "이번에 교체한 소모품" 체크 → 교체 이력·주기 계산
alter table public.consumable_readings add column replaced boolean not null default false;
