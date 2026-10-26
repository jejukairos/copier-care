-- 로그인 계정(공용계정)과 실제 직원을 분리: 직원 명단 테이블
create table public.staff (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 담당 직원 / 점검자 / 교체자는 직원 명단을 가리키도록 변경 (아직 데이터 없음)
alter table public.machines drop constraint machines_staff_id_fkey;
alter table public.machines alter column staff_id type bigint using null;
alter table public.machines add foreign key (staff_id) references public.staff on delete set null;

alter table public.inspections drop constraint inspections_inspector_id_fkey;
alter table public.inspections alter column inspector_id type bigint using null;
alter table public.inspections add foreign key (inspector_id) references public.staff on delete set null;

alter table public.part_replacements drop constraint part_replacements_replaced_by_fkey;
alter table public.part_replacements alter column replaced_by type bigint using null;
alter table public.part_replacements add foreign key (replaced_by) references public.staff on delete set null;

grant select, insert, update, delete on public.staff to authenticated;
grant all on public.staff to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter table public.staff enable row level security;
create policy staff_select on public.staff for select to authenticated using (public.is_active());
create policy staff_write on public.staff for all to authenticated using (public.is_admin()) with check (public.is_admin());
