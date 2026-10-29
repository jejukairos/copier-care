// 홈·사진 올리기 화면 공용 기계번호 입력창. 입력 중에 등록된 기계번호가 추천됨
export function MachineSearch({ machines, q }: { machines: { serial: string; clients: { name: string } | null }[]; q?: string }) {
  return (
    <form action="/inspect" className="card flex flex-col gap-2 border-blue-200 bg-blue-50">
      <label htmlFor="q" className="font-semibold">📷 사진 올리기 · 소모품 입력</label>
      <div className="flex gap-2">
        <input id="q" name="q" list="machine-serials" defaultValue={q} required autoComplete="off" enterKeyHint="go"
          placeholder="기계번호 (일부만 입력해도 됨)" className="input flex-1" />
        <button className="btn shrink-0">찾기</button>
      </div>
      <datalist id="machine-serials">
        {machines.map((m) => <option key={m.serial} value={m.serial}>{m.clients?.name}</option>)}
      </datalist>
    </form>
  );
}
