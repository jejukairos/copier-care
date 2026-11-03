// 홈·사진 올리기 화면 공용 입력창. 기계번호·거래처명 일부만 쳐도 됨, 입력 중에 추천 목록
export function MachineSearch({ machines, q }: { machines: { serial: string; clients: { name: string } | null }[]; q?: string }) {
  const names = [...new Set(machines.map((m) => m.clients?.name).filter(Boolean))];
  return (
    <form action="/inspect" className="card flex flex-col gap-2 border-blue-200 bg-blue-50">
      <label htmlFor="q" className="font-semibold">📷 사진 올리기 · 소모품 입력</label>
      <div className="flex gap-2">
        <input id="q" name="q" list="machine-serials" defaultValue={q} required autoComplete="off" enterKeyHint="go"
          placeholder="기계번호 또는 거래처명 (일부만)" className="input flex-1" />
        <button className="btn shrink-0">찾기</button>
      </div>
      <datalist id="machine-serials">
        {machines.map((m) => <option key={m.serial} value={m.serial}>{m.clients?.name}</option>)}
        {names.map((n) => <option key={n} value={n!} />)}
      </datalist>
    </form>
  );
}
