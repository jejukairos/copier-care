import Link from "next/link";
import { Page, requireMe } from "@/lib/page";
import { signOut } from "./actions";

export default async function Home() {
  const { profile, user, isAdmin } = await requireMe();

  if (profile?.active === false) {
    return <Page title="정기점검 관리"><p className="rounded-lg bg-red-50 p-4 text-red-700">사용이 중지된 계정입니다. 관리자에게 문의하세요.</p></Page>;
  }

  const menu = [
    { href: "/clients", label: "거래처 · 기계", desc: "거래처, 기계, 계약 등록·검색" },
    ...(isAdmin ? [
      { href: "/staff", label: "직원 명단", desc: "담당·점검 직원 관리" },
      { href: "/settings/items", label: "소모품 · 부품 항목", desc: "점검 항목 추가·수정" },
    ] : []),
  ];

  return (
    <Page
      title="정기점검 관리"
      right={<form action={signOut}><button className="rounded-lg border border-gray-300 px-3 py-2 text-sm">로그아웃</button></form>}
    >
      <p className="text-sm text-gray-500">{profile?.name ?? user.email} · {isAdmin ? "관리자" : "직원"}</p>
      <nav className="flex flex-col gap-3">
        {menu.map((m) => (
          <Link key={m.href} href={m.href} className="card active:bg-gray-50">
            <p className="text-lg font-semibold">{m.label}</p>
            <p className="text-sm text-gray-500">{m.desc}</p>
          </Link>
        ))}
      </nav>
    </Page>
  );
}
