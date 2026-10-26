@AGENTS.md

# copier-care — 복사기 임대업체 사내 정기점검 관리 웹앱

## 사용자 / 소통 방식
- 사용자는 **비개발자**. 항상 한국어로, Supabase/Netlify 등 설정은 **클릭 순서대로** 안내.
- **단계별 진행**: 각 단계 끝나면 사용자가 직접 확인하는 방법을 알려주고 확인 받은 뒤 다음 단계로.
- 비밀키는 채팅에 붙여넣게 하지 말 것 → `.env.local`에 사용자가 직접 입력 (git 제외됨, `.env.example`만 커밋).
- **모든 것을 무료로 유지**가 최우선 조건 (유료 전환으로 멈추는 것 싫어함). 카드 등록 없이 무료 플랜만.

## 확정된 결정 (2026-10-25)
| 항목 | 결정 |
|---|---|
| 스택 | Next.js(App Router, 이 폴더에 생성됨) + TypeScript + Tailwind, 모바일 우선 |
| 호스팅 | **Netlify 무료** (Vercel Hobby는 약관상 비상업 전용이라 제외). 아침 요약은 Netlify Scheduled Functions |
| DB/로그인/사진 | Supabase 무료 (Seoul 리전) |
| 사진 판독 | **직접 입력** (AI 없음). 단 `lib/ai/` 판독 코드는 `ANTHROPIC_API_KEY` 있을 때만 켜지게 구조만 준비 (모델 `claude-sonnet-5-5`) |
| 알림 | **웹 푸시(PWA)** 무료. 솔라피 문자/알림톡은 모듈만 만들고 env 비면 꺼짐 |
| 업로드 단위 | 한 번에 **기계 1대** (카운터 화면 + 소모품 화면 사진) |
| 계약 | **기계별**, 적용 시작일 있는 이력으로 관리 (단가 변경 시 과거 계산 유지) |
| 점검 예정일 | 기계마다 **"매월 ○일" 고정** (31일 등 없는 날은 말일). 특정 달만 수동 변경 가능. 실제 날짜는 사용자가 기계별로 알려줄 예정 |
| 접근 | 공개가입 끔. **(2026-10-26 변경) 사무실 공용계정 1개**로 휴대폰마다 처음 1번만 로그인(세션 유지). 로그인 없이 쓰는 건 거래처 정보 노출 위험 설명 후 사용자가 공용계정 선택. 관리자 계정(hyunmodpdy@naver.com)은 별도 유지 |
| 직원 | 계정≠직원. **②단계에서 `staff`(이름·휴대폰) 명단 테이블 추가**하고 machines.staff_id / inspections.inspector_id / part_replacements.replaced_by 를 staff 참조로 변경. 점검 저장 시 점검자를 목록에서 선택(기기에 마지막 선택 기억). 푸시 구독도 기기별로 staff에 연결 |

## 정산 규칙 (중요)
- **정기점검끼리만** 사용량/초과/추가임대료 계산. 수시방문(고장 등)은 카운터·소모품 기록만(추세용), 정산 제외.
- 사용량 = 이번 정기 카운터 − 직전 정기 카운터 (흑백/칼라 각각). 초과 = max(0, 사용량 − 기본매수). 추가임대료 = 초과흑백×흑백단가 + 초과칼라×칼라단가. 저장 시점 값으로 inspections에 스냅샷 저장.
- 카운터가 직전보다 작으면 경고, 메모 필수. 첫 점검은 기준값으로만 저장.
- 예정일 ±3일(설정 변경 가능, 전날 포함) 안에 저장하면 "○월 정기점검으로 처리할까요?" 확인.
- 예정일과 다르면 자동 코멘트 (예: "예정일 11/22(일) → 11/20(금) 점검, 주말로 2일 앞당김, 정산기간 28일").
- 예정일이 토·일·공휴일이면 직전 평일 아침 요약에 미리 알림. 공휴일 2026~2027 기본 목록 + 설정에서 추가.

## 직접 입력 화면 (③단계)
사진 위 / 입력칸 아래, 사진 핀치 확대. 기계는 검색으로 선택. 지난번 값 미리 채움. 이상값 노란/빨간 표시(카운터 감소, 소모품 % 이유 없는 큰 증가, 평소 사용량 3배 이상).

## 데이터 구조
profiles(이름, 휴대폰, role, active) / clients / machines(기계번호 UNIQUE, 거래처, 기종, color|mono, 트레이수 2~4, 설치일, 담당직원, 매월 점검일) / contracts / inspections(정기|수시 구분, 카운터, 메모, 자동코멘트, 계산 스냅샷) / inspection_photos / consumable_types·part_types(설정 화면에서 추가/수정, 트레이 롤러는 트레이수 이하만 표시) / consumable_readings / part_replacements(교체일, 교체시점 카운터, 교체자, 메모) / app_settings(긴급 10%, 주의 20%, 정기점검 허용범위 3일 등) / holidays / alert_log(같은 항목 미해소 시 재발송 금지, 잔량 회복 시 해소) / push_subscriptions.
- 컬러기 소모품: 토너K/C/M/Y, 토너회수통, R1~R4, 현상기K/C/M/Y (주로 교체: 토너 4색, 회수통). 흑백기: 토너, 드럼, 정착기.
- 부품: 트레이1~4 롤러, DADF롤러, 리타드츄트, 1st 토너회수통, 정착기, IBT벨트, 2nd BTR, ESS PWB, Fusing motor.
- RLS: staff 조회·등록·수정, admin은 삭제·직원초대·설정·계약단가. Supabase 2026-10-30 변경 대비 마이그레이션에 **명시적 GRANT** 작성.

## 대시보드·기타 기능
조치요망(긴급 빨강 → 주의 주황 → 소진예상일 빠른 순 → 이번 달 초과 거래처 → 점검 예정일 지난 기계). 소진예상일 = 마지막 교체(잔량 상승) 이후 기록의 직선 추세, 기록 2회 미만이면 "추정 불가". 검색(기계번호/회사명 부분일치), 기계 상세(그래프·추이·교체이력·사진), 월별 리포트 + 엑셀.

## 무료 한도 대응
- 사진은 브라우저에서 ~200KB로 줄여 **Supabase Storage로 직접 업로드** (Netlify 크레딧 안 씀). Storage 1GB ≈ 5,000장 → 오래된 사진만 삭제 기능(숫자 유지).
- Supabase 7일 미사용 시 정지 → 매일 예약 작업이 DB 접근. 자동 백업 없음 → 설정에 "전체 데이터 엑셀 백업" 버튼.
- Netlify 무료 월 300크레딧, 초과 시 과금 없이 정지 → 설정에 사용량 표시, 70% 넘으면 관리자 푸시.

## 단계 진행 현황
> 사용자는 **휴대폰이 주 작업 환경**(원격 제어로 대화). 실제 거래처·기계 입력도 휴대폰으로 할 예정 → **②가 끝나면 바로 Netlify 배포**(⑥을 앞당김), 이후 단계는 재배포로 반영.
> Project URL·Publishable(anon) 키는 공개용 키라 채팅으로 받아 내가 `.env.local`에 입력해도 됨. Secret 키는 채팅 금지 → 직원 초대는 당분간 Supabase 대시보드(Authentication > Users > Invite user)로 하고, Secret 키는 배포 때 Netlify 환경변수에 사용자가 직접 입력.

- [x] **0. 준비**: Node.js 24.22.1 LTS 설치(winget), `create-next-app`으로 이 폴더 생성, `@supabase/supabase-js` `@supabase/ssr` 설치, `.env.local`(빈 키 템플릿)/`.env.example` 작성, `.gitignore`에 `!.env.example` 추가. localhost:3000 응답 200 확인.
- [ ] **(대기 중) 사용자 작업**: Supabase 가입·프로젝트 생성(Free, Seoul) 후 Project URL / Publishable(anon) / Secret(service_role) 키를 `.env.local`에 입력 → 사용자가 "키 입력 완료"라고 하면 연결 확인.
- [~] ① DB 작성 완료: `supabase/migrations/0001_init.sql`(스키마·RLS·Storage), `supabase/seed.sql`(설정·항목·공휴일·샘플). PGlite로 실행·계산·RLS 검증 완료. **2026-10-26 실제 Supabase에 적용 완료**(거래처3·기계5·점검15·공휴일40). 첫 가입 계정이 자동 admin.
  - 휴대폰 SQL Editor 붙여넣기는 깨짐 → SQL은 PC에서 `pg`로 실행. 접속: host `aws-0-ap-northeast-2.pooler.supabase.com:5432`, user `postgres.yizpezsoilddkaukeaxr` (비밀번호는 저장 안 함, 사용자에게 매번 받기·사용 후 재설정 권장).
- [x] 공개가입 끔, DB 비밀번호 재설정 완료(확인함).
- [~] ① 로그인: 이메일+비밀번호 로그인(`app/login`), `proxy.ts`(Next16의 middleware)로 세션 갱신·비로그인 리다이렉트, 로그아웃. `next.config.ts`에서 cacheComponents 끔(전 화면 사용자별 동적). 빌드 통과.
  - 초대 메일 링크는 Site URL(localhost)로 가서 휴대폰에서 안 열림 → **계정은 Supabase 대시보드 Authentication > Users > Add user > Create new user(Auto Confirm)로 생성**. 앱 내 직원 추가는 배포 후 고려.
- [x] **배포 완료**: https://copier-care-8837.netlify.app (Netlify site id `2ddc9cde-57e4-465a-891f-d7e92077b420`), 코드 GitHub 비공개 `jejukairos/copier-care`.
  - 배포 방식: **main에 push → GitHub Actions(`.github/workflows/deploy.yml`)가 리눅스에서 빌드 → netlify-cli로 배포**. 이유: Windows 로컬 `netlify deploy --build`는 엣지함수 경로 버그로 실패, Netlify 무료플랜은 비공개 저장소 Git 빌드를 "Unrecognized Git contributor"로 차단. Netlify 쪽 Git 빌드는 `stop_builds=true`로 꺼둠.
  - GitHub Secrets: `NETLIFY_AUTH_TOKEN`(사용자 허락 받고 저장), `NETLIFY_SITE_ID`. PowerShell 파이프로 넣으면 BOM 붙어 깨짐 → `gh secret set --body` 사용.
  - Netlify 기본 "팀원만 접속(sso_login)" 보호는 운영에서 해제함. 환경변수 NEXT_PUBLIC_SUPABASE_URL/ANON_KEY는 Netlify에 설정됨.
  - 배포 확인: `gh run list --repo jejukairos/copier-care`. (테이블·RLS·샘플데이터: 거래처 3곳, 컬러기 3대, 흑백기 2대, 각 3개월치 점검기록 / 초대 로그인 / 권한 구분)
- [~] ② 거래처/기계/계약 등록, 항목 관리, 부품 교체이력, 직원 명단 — 코드 배포 완료(2026-10-26), `0002_staff.sql`은 사용자가 휴대폰 SQL Editor로 적용(짧은 SQL은 한 줄 1문장으로 주면 휴대폰 붙여넣기 OK). 사용자 확인 대기.
- [ ] ③ 사진 업로드 + 직접 입력 + 저장 시 계산
- [ ] ④ 대시보드·검색·기계 상세·월별 리포트·엑셀
- [ ] ⑤ 웹 푸시 알림 + 아침 8시(KST) 요약 + 중복 방지
- [ ] ⑥ GitHub + Netlify 배포 (가입은 이때 안내)

## 개발 환경 메모 (Windows / PowerShell)
- Node 설치 직후라 새 셸에서 PATH가 안 잡히면 명령 앞에:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
- 개발 서버 `npm run dev`(백그라운드 최대 2시간 후 자동 종료됨). 사용자에게 직접 켜는 법도 안내함.
