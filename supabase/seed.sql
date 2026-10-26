-- 기본 설정 + 테스트용 샘플 데이터. 0001_init.sql 실행 후 SQL Editor 에서 Run.

-- ===== 기본 설정 =====
insert into app_settings (key, value) values
  ('urgent_percent', '10'),        -- 이하 긴급(빨강)
  ('warning_percent', '20'),       -- 이하 주의(주황)
  ('regular_window_days', '3');    -- 예정일 ±N일이면 정기점검인지 확인

insert into consumable_types (code, name, applies_to, is_main, sort) values
  ('TK','토너 K','color',true,1), ('TC','토너 C','color',true,2),
  ('TM','토너 M','color',true,3), ('TY','토너 Y','color',true,4),
  ('WASTE','토너회수통','color',true,5),
  ('R1','R1','color',false,6), ('R2','R2','color',false,7),
  ('R3','R3','color',false,8), ('R4','R4','color',false,9),
  ('DK','현상기 K','color',false,10), ('DC','현상기 C','color',false,11),
  ('DM','현상기 M','color',false,12), ('DY','현상기 Y','color',false,13),
  ('M_TONER','토너','mono',true,1), ('M_DRUM','드럼','mono',false,2), ('M_FUSER','정착기','mono',false,3);

insert into part_types (name, applies_to, tray_no, sort) values
  ('트레이1 롤러','both',1,1), ('트레이2 롤러','both',2,2),
  ('트레이3 롤러','both',3,3), ('트레이4 롤러','both',4,4),
  ('DADF롤러','both',null,5), ('리타드츄트','both',null,6),
  ('1st 토너회수통','color',null,7), ('정착기','both',null,8),
  ('IBT벨트','color',null,9), ('2nd BTR','color',null,10),
  ('ESS PWB','both',null,11), ('Fusing motor','both',null,12);

-- 공휴일 (대체공휴일 포함, 설정 화면에서 수정 가능)
insert into holidays (day, name) values
  ('2026-01-01','신정'), ('2026-02-16','설날'), ('2026-02-17','설날'), ('2026-02-18','설날'),
  ('2026-03-01','삼일절'), ('2026-03-02','대체공휴일'), ('2026-05-05','어린이날'),
  ('2026-05-24','부처님오신날'), ('2026-05-25','대체공휴일'), ('2026-06-03','지방선거'),
  ('2026-06-06','현충일'), ('2026-08-15','광복절'), ('2026-08-17','대체공휴일'),
  ('2026-09-24','추석'), ('2026-09-25','추석'), ('2026-09-26','추석'),
  ('2026-10-03','개천절'), ('2026-10-05','대체공휴일'), ('2026-10-09','한글날'), ('2026-12-25','성탄절'),
  ('2027-01-01','신정'), ('2027-02-06','설날'), ('2027-02-07','설날'), ('2027-02-08','설날'),
  ('2027-02-09','대체공휴일'), ('2027-03-01','삼일절'), ('2027-05-05','어린이날'),
  ('2027-05-13','부처님오신날'), ('2027-06-06','현충일'), ('2027-08-15','광복절'),
  ('2027-08-16','대체공휴일'), ('2027-09-14','추석'), ('2027-09-15','추석'), ('2027-09-16','추석'),
  ('2027-10-03','개천절'), ('2027-10-04','대체공휴일'), ('2027-10-09','한글날'),
  ('2027-10-11','대체공휴일'), ('2027-12-25','성탄절'), ('2027-12-27','대체공휴일');

-- ===== 샘플: 거래처 3곳 =====
insert into clients (name, contact_name, phone, address) values
  ('(샘플) 강남디자인', '김대리', '02-555-0101', '서울 강남구 테헤란로 1'),
  ('(샘플) 한빛세무회계', '이과장', '02-555-0202', '서울 서초구 서초대로 2'),
  ('(샘플) 대성물산', '박부장', '031-555-0303', '경기 성남시 분당구 판교로 3');

-- ===== 샘플: 컬러기 3대, 흑백기 2대 =====
insert into machines (serial, client_id, model, color_type, tray_count, installed_on, inspection_day)
select v.serial, c.id, v.model, v.color_type, v.trays, v.installed::date, v.day
from (values
  ('C-1001','(샘플) 강남디자인','DocuCentre C5570','color',4,'2024-03-02',5),
  ('C-1002','(샘플) 강남디자인','DocuCentre C3370','color',3,'2024-06-10',15),
  ('C-2001','(샘플) 한빛세무회계','ApeosPort C2560','color',2,'2025-01-20',20),
  ('M-3001','(샘플) 한빛세무회계','DocuCentre 5070','mono',2,'2023-11-05',10),
  ('M-3002','(샘플) 대성물산','ApeosPort 6570','mono',3,'2024-09-25',25)
) v(serial, client, model, color_type, trays, installed, day)
join clients c on c.name = v.client;

insert into contracts (machine_id, starts_on, base_mono, base_color, monthly_fee, over_mono_price, over_color_price)
select m.id, '2024-01-01', v.bm, v.bc, v.fee, v.pm, v.pc
from (values
  ('C-1001',3000,1000,100000,10,80),
  ('C-1002',2000, 500, 80000,10,70),
  ('C-2001',1500, 300, 60000,12,90),
  ('M-3001',3000,   0, 50000,10, 0),
  ('M-3002',5000,   0, 70000, 8, 0)
) v(serial, bm, bc, fee, pm, pc)
join machines m on m.serial = v.serial;

-- ===== 샘플: 2026년 8~10월 정기점검 (주말·공휴일은 앞당김) =====
insert into inspections (machine_id, inspected_on, kind, period_month, mono_counter, color_counter, auto_comment)
select m.id, v.d::date, 'regular', v.pm::date, v.mono, v.color, v.cmt
from (values
  ('C-1001','2026-08-05','2026-08-01',120000,40000,null),
  ('C-1001','2026-09-04','2026-09-01',123500,41200,'예정일 9/5(토) → 9/4(금) 점검, 주말로 1일 앞당김'),
  ('C-1001','2026-10-02','2026-10-01',126200,41900,'예정일 10/5(월, 대체공휴일) → 10/2(금) 점검, 공휴일로 3일 앞당김'),
  ('C-1002','2026-08-14','2026-08-01', 50000,10000,'예정일 8/15(토, 광복절) → 8/14(금) 점검, 1일 앞당김'),
  ('C-1002','2026-09-15','2026-09-01', 51800,10450,null),
  ('C-1002','2026-10-15','2026-10-01', 53900,10900,null),
  ('C-2001','2026-08-20','2026-08-01', 30000, 5000,null),
  ('C-2001','2026-09-18','2026-09-01', 31200, 5250,'예정일 9/20(일) → 9/18(금) 점검, 주말로 2일 앞당김'),
  ('C-2001','2026-10-20','2026-10-01', 32400, 5600,null),
  ('M-3001','2026-08-10','2026-08-01',200000, null,null),
  ('M-3001','2026-09-10','2026-09-01',203200, null,null),
  ('M-3001','2026-10-08','2026-10-01',206100, null,'예정일 10/10(토) → 10/8(목) 점검, 주말·한글날로 2일 앞당김'),
  ('M-3002','2026-08-25','2026-08-01',400000, null,null),
  ('M-3002','2026-09-23','2026-09-01',405800, null,'예정일 9/25(금, 추석) → 9/23(수) 점검, 연휴로 2일 앞당김'),
  ('M-3002','2026-10-23','2026-10-01',411500, null,'예정일 10/25(일) → 10/23(금) 점검, 주말로 2일 앞당김')
) v(serial, d, pm, mono, color, cmt)
join machines m on m.serial = v.serial;

-- 사용량·초과매수·추가임대료 (직전 정기점검 대비). 실제 앱에서는 저장 시 같은 규칙으로 계산.
with x as (
  select i.id, i.machine_id,
         i.mono_counter  - lag(i.mono_counter)  over w as mu,
         i.color_counter - lag(i.color_counter) over w as cu
  from inspections i where i.kind = 'regular'
  window w as (partition by i.machine_id order by i.period_month)
)
update inspections i set
  mono_usage = x.mu,
  color_usage = x.cu,
  over_mono = greatest(0, x.mu - c.base_mono),
  over_color = greatest(0, x.cu - c.base_color),
  extra_fee = greatest(0, x.mu - c.base_mono) * c.over_mono_price
            + coalesce(greatest(0, x.cu - c.base_color) * c.over_color_price, 0)
from x join contracts c on c.machine_id = x.machine_id
where i.id = x.id and x.mu is not null;

-- 소모품 잔량: 달마다 줄어들게 생성
insert into consumable_readings (inspection_id, consumable_type_id, percent)
select i.id, ct.id,
       greatest(3, 90 - (extract(month from i.period_month)::int - 8) * 25 - (ct.sort * 13 % 25))
from inspections i
join machines m on m.id = i.machine_id
join consumable_types ct on ct.applies_to = m.color_type;

-- 대시보드 확인용: 긴급 2건(빨강), 주의 1건(주황)
update consumable_readings r set percent = v.p
from (values ('C-1001','TK',8), ('C-1002','TY',18), ('M-3002','M_TONER',9)) v(serial, code, p),
     machines m, consumable_types ct, inspections i
where m.serial = v.serial and ct.code = v.code and i.machine_id = m.id
  and i.period_month = '2026-10-01' and r.inspection_id = i.id and r.consumable_type_id = ct.id;

-- 부품 교체이력 샘플
insert into part_replacements (machine_id, part_type_id, replaced_on, counter_at, memo)
select m.id, p.id, '2026-09-04', 123500, '정착기 소음으로 교체'
from machines m, part_types p where m.serial = 'C-1001' and p.name = '정착기';
