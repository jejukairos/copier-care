import { redirect } from "next/navigation";
import { Page, requireMe, str } from "@/lib/page";
import { createClient } from "@/lib/supabase/server";

async function saveStaff(form: FormData) {
  "use server";
  const supabase = await createClient();
  const id = str(form, "id");
  const row = { name: str(form, "name"), phone: str(form, "phone"), active: form.get("active") !== "off" };
  const { error } = id
    ? await supabase.from("staff").update(row).eq("id", id)
    : await supabase.from("staff").insert(row);
  redirect(error ? `/staff?error=${encodeURIComponent("저장 실패: " + error.message)}` : "/staff");
}

export default async function StaffPage({ searchParams }: PageProps<"/staff">) {
  await requireMe({ adminOnly: true });
  const { error } = await searchParams;
  const { data: staff } = await (await createClient()).from("staff").select("*").order("active", { ascending: false }).order("name");

  return (
    <Page title="직원 명단" back="/" error={error as string | undefined}>
      <form action={saveStaff} className="card flex flex-col gap-3">
        <p className="font-semibold">직원 추가</p>
        <input name="name" required placeholder="이름" className="input" />
        <input name="phone" type="tel" placeholder="휴대폰 (알림용)" className="input" />
        <button className="btn">추가</button>
      </form>
      {staff?.map((s) => (
        <form key={s.id} action={saveStaff} className={`card flex flex-col gap-2 ${s.active ? "" : "opacity-50"}`}>
          <input type="hidden" name="id" value={s.id} />
          <div className="grid grid-cols-2 gap-2">
            <input name="name" required defaultValue={s.name} className="input" />
            <input name="phone" type="tel" defaultValue={s.phone ?? ""} placeholder="휴대폰" className="input" />
          </div>
          <div className="flex items-center gap-2">
            <select name="active" defaultValue={s.active ? "on" : "off"} className="input flex-1">
              <option value="on">근무 중</option>
              <option value="off">퇴사 (목록에서 숨김)</option>
            </select>
            <button className="btn-outline shrink-0">수정</button>
          </div>
        </form>
      ))}
    </Page>
  );
}
