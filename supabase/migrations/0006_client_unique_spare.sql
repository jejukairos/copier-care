-- 1) 같은 회사명 중복 정리: 기계가 없는 중복만 삭제 (기계 달린 것 > 먼저 만든 것 순으로 1개 남김)
delete from public.clients c where not exists (select 1 from public.machines m where m.client_id = c.id) and exists (select 1 from public.clients d where d.name = c.name and d.id <> c.id and (d.id < c.id or exists (select 1 from public.machines m2 where m2.client_id = d.id)));
-- 2) 같은 회사명은 다시 못 만들게 (저장 버튼 여러 번 눌러도 1개)
create unique index clients_name_key on public.clients (name);
-- 3) 소모품별 현장에 두고 온 여유분 개수
alter table public.consumable_readings add column spare smallint check (spare between 0 and 99);
