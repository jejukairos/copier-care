-- copier-care 초기 스키마: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run

-- ===== 직원 계정 =====
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  phone text,
  role text not null default 'staff' check (role in ('admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 초대받은 사람이 가입되면 profiles 자동 생성. 첫 번째 계정은 관리자.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where role = 'admin') then 'staff' else 'admin' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin')
$$;

-- ===== 거래처 / 기계 / 계약 =====
create table public.clients (
  id bigint generated always as identity primary key,
  name text not null,
  contact_name text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table public.machines (
  id bigint generated always as identity primary key,
  serial text not null unique,
  client_id bigint not null references public.clients on delete restrict,
  model text not null,
  color_type text not null check (color_type in ('color','mono')),
  tray_count int not null default 2 check (tray_count between 2 and 4),
  installed_on date,
  staff_id uuid references public.profiles on delete set null,
  inspection_day int check (inspection_day between 1 and 31), -- 매월 ○일 (없는 날이면 말일)
  active boolean not null default true,
  memo text,
  created_at timestamptz not null default now()
);

-- 특정 달만 예정일 변경
create table public.schedule_overrides (
  machine_id bigint not null references public.machines on delete cascade,
  month date not null check (extract(day from month) = 1),
  due_on date not null,
  primary key (machine_id, month)
);

create table public.contracts (
  id bigint generated always as identity primary key,
  machine_id bigint not null references public.machines on delete cascade,
  starts_on date not null,
  base_mono int not null default 0,
  base_color int not null default 0,
  monthly_fee int not null default 0,
  over_mono_price numeric(10,2) not null default 0,
  over_color_price numeric(10,2) not null default 0,
  unique (machine_id, starts_on)
);

-- ===== 점검 =====
create table public.inspections (
  id bigint generated always as identity primary key,
  machine_id bigint not null references public.machines on delete cascade,
  inspected_on date not null,
  inspector_id uuid references public.profiles on delete set null,
  kind text not null default 'regular' check (kind in ('regular','visit')), -- 정기 / 수시방문
  period_month date check (extract(day from period_month) = 1),            -- 정기점검이 해당하는 달
  mono_counter bigint,
  color_counter bigint,
  -- 저장 시점 계산 스냅샷 (정기점검만)
  mono_usage bigint,
  color_usage bigint,
  over_mono bigint,
  over_color bigint,
  extra_fee numeric(12,2),
  auto_comment text,
  memo text,
  created_at timestamptz not null default now(),
  check (kind = 'visit' or period_month is not null)
);
create unique index inspections_one_regular_per_month
  on public.inspections (machine_id, period_month) where kind = 'regular';
create index on public.inspections (machine_id, inspected_on desc);

create table public.inspection_photos (
  id bigint generated always as identity primary key,
  inspection_id bigint not null references public.inspections on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

-- ===== 소모품 / 부품 (설정 화면에서 추가·수정) =====
create table public.consumable_types (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  applies_to text not null check (applies_to in ('color','mono')),
  is_main boolean not null default false, -- 주로 교체하는 항목
  sort int not null default 0,
  active boolean not null default true
);

create table public.consumable_readings (
  inspection_id bigint not null references public.inspections on delete cascade,
  consumable_type_id bigint not null references public.consumable_types on delete restrict,
  percent int not null check (percent between 0 and 100),
  primary key (inspection_id, consumable_type_id)
);

create table public.part_types (
  id bigint generated always as identity primary key,
  name text not null,
  applies_to text not null default 'both' check (applies_to in ('color','mono','both')),
  tray_no int check (tray_no between 1 and 4), -- 트레이 롤러: 기계 트레이수 이하만 표시
  sort int not null default 0,
  active boolean not null default true
);

create table public.part_replacements (
  id bigint generated always as identity primary key,
  machine_id bigint not null references public.machines on delete cascade,
  part_type_id bigint not null references public.part_types on delete restrict,
  replaced_on date not null,
  counter_at bigint,
  replaced_by uuid references public.profiles on delete set null,
  memo text,
  created_at timestamptz not null default now()
);

-- ===== 설정 / 공휴일 / 알림 =====
create table public.app_settings (
  key text primary key,
  value jsonb not null
);

create table public.holidays (
  day date primary key,
  name text not null
);

create table public.alert_log (
  id bigint generated always as identity primary key,
  machine_id bigint not null references public.machines on delete cascade,
  consumable_type_id bigint not null references public.consumable_types on delete cascade,
  sent_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- 같은 항목은 해소되기 전까지 한 번만 발송
create unique index alert_log_open_once
  on public.alert_log (machine_id, consumable_type_id) where resolved_at is null;

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ===== 권한 (Supabase 2026-10-30 변경 대비 명시적 GRANT) =====
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.is_active(), public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.machines enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.contracts enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.consumable_types enable row level security;
alter table public.consumable_readings enable row level security;
alter table public.part_types enable row level security;
alter table public.part_replacements enable row level security;
alter table public.app_settings enable row level security;
alter table public.holidays enable row level security;
alter table public.alert_log enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: 직원끼리 조회, 본인 정보 수정, 관리자는 전체 수정
create policy profiles_select on public.profiles for select to authenticated using (public.is_active());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (public.is_admin() or (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()) and active));

-- 직원: 조회·등록·수정 / 관리자: 삭제
do $$
declare t text;
begin
  foreach t in array array['clients','machines','schedule_overrides','inspections','inspection_photos',
                           'consumable_readings','part_replacements','alert_log'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_active())', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_active())', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_active()) with check (public.is_active())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_admin())', t);
  end loop;
  -- 계약단가·설정·항목·공휴일: 조회는 직원, 변경은 관리자
  foreach t in array array['contracts','consumable_types','part_types','app_settings','holidays'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_active())', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 푸시 구독: 본인 것만
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active());

-- ===== 사진 저장소 (비공개) =====
insert into storage.buckets (id, name, public) values ('inspection-photos', 'inspection-photos', false);

create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos' and public.is_active());
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos' and public.is_active());
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'inspection-photos' and public.is_admin());
