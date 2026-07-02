const { useState } = React;

/* ---------- icons ---------- */
const I = {
  check:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  alert:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z"/></svg>,
  clock:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  doc:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/></svg>,
  flask:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6"/><path d="M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/><path d="M7 15h10"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>,
  scan:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M4 12h16"/></svg>,
  menu:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>,
  arrow:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  box:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>,
  grid:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  inbox:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5Z"/></svg>,
  more:   <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
  x:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>,
  cam:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></svg>,
  plus:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
};

/* ---------- data: one card = one receiving, reasons = checklist ---------- */
// 입고 검수·격리는 상단 QR 스캔이 담당 → 이 화면은 '문서' 단일 게이트만 관리
const CASES = [
  { id:'RCV-2026-0031', title:'PBS-3 외 2종', vendor:'대한바이오', lines:3, arrived:'6/28 도착',
    doc:{state:'miss', label:'성적서(CoA) 미첨부', detail:'3개 라인 중 1건 · 필수 시험성적서 누락'} },
  { id:'RCV-2026-0028', title:'Mycoplasma Test Kit', vendor:'세포라인', lines:1, arrived:'6/29 도착',
    doc:{state:'miss', label:'MSDS 미첨부', detail:'물질안전보건자료 — 등록 필요'} },
  { id:'RCV-2026-0025', title:'Sigma-Tech PBS 1X', vendor:'시그마코리아', lines:1, arrived:'6/29 도착',
    doc:{state:'ok', label:'문서 확인 완료', detail:'성적서·MSDS 모두 확인됨'} },
  { id:'RCV-2026-0022', title:'DPBS 500mL 외 1종', vendor:'웰진', lines:2, arrived:'6/30 도착',
    doc:{state:'ok', label:'문서 확인 완료', detail:'성적서·MSDS 모두 확인됨'} },
];

const FILTERS = [
  {k:'all',     label:'전체'},
  {k:'blocked', label:'문서 대기', danger:true},
  {k:'ready',   label:'반영 가능'},
];

/* ---------- helpers ---------- */
function statusOf(c){ return c.doc.state==='ok' ? 'ready' : 'blocked'; }

/* ---------- components ---------- */
function Pill({status}){
  if(status==='ready') return <span className="pill ready">{I.check} 반영 준비됨</span>;
  if(status==='blocked') return <span className="pill blocked">{I.alert} 차단</span>;
  return <span className="pill warn">{I.flask} 진행 중</span>;
}

function Case({c, onAction}){
  const status = statusOf(c);
  const ok = status==='ready';
  return (
    <div className={'case '+status}>
      <div className="case-rail"></div>
      <div className="case-h">
        <div className="case-top">
          <Pill status={status} />
          <span className="sp"></span>
          {c.arrived && <span className="due">{I.box}{c.arrived}</span>}
        </div>
        <div className="case-id">{c.id}</div>
        <div className="case-title">{c.title}</div>
        <div className="case-meta">
          <span className="vendor">{c.vendor}</span>
          <span className="dot"></span><span>{c.lines}개 라인</span>
        </div>
      </div>

      <div className={'docgate '+(ok?'ok':'miss')}>
        <span className="dg-ic">{ok ? I.check : I.doc}</span>
        <div className="dg-bd">
          <div className="dg-l">{c.doc.label}</div>
          <div className="dg-d">{c.doc.detail}</div>
        </div>
      </div>

      <div className="case-f single">
        {ok
          ? <button className="act go">재고 반영 {I.arrow}</button>
          : <button className="act next" onClick={onAction}>문서 첨부 {I.arrow}</button>}
      </div>
    </div>
  );
}

/* ---------- 문서 첨부 바텀시트 ---------- */
const DOC_REQ = {
  'RCV-2026-0031': {
    line:'PBS-3 (3개 라인 중 1건)',
    docs:[
      {k:'coa', name:'성적서 (CoA)', req:true,  state:'miss', note:'Lot별 시험성적서 — GMP 필수'},
      {k:'msds',name:'MSDS',        req:true,  state:'ok',   note:'2024-08 개정본 첨부됨'},
      {k:'inv', name:'거래명세서',    req:false, state:'ok',   note:'대한바이오 발행'},
    ],
  },
  'RCV-2026-0028': {
    line:'Mycoplasma Test Kit (1개 라인)',
    docs:[
      {k:'msds',name:'MSDS',        req:true,  state:'miss', note:'물질안전보건자료 — 등록 필요'},
      {k:'coa', name:'성적서 (CoA)', req:true,  state:'ok',   note:'세포라인 발행 · 확인됨'},
      {k:'inv', name:'거래명세서',    req:false, state:'ok',   note:'세포라인 발행'},
    ],
  },
};

function DocSheet({c, onClose, onDone}){
  const cfg = DOC_REQ[c.id] || {line:c.title, docs:[{k:'coa',name:'성적서 (CoA)',req:true,state:'miss'}]};
  const [docs, setDocs] = useState(cfg.docs);
  const attach = k => setDocs(ds=> ds.map(d=> d.k===k ? {...d, state:'ok', note:'방금 첨부됨 · 검토 대기'} : d));
  const missingReq = docs.filter(d=> d.req && d.state==='miss');
  const ready = missingReq.length===0;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-grab"></div>
        <div className="sheet-h">
          <div>
            <div className="sheet-ey">{I.doc} 문서 첨부</div>
            <div className="sheet-t">{c.id}</div>
            <div className="sheet-s">{cfg.line}</div>
          </div>
          <button className="sheet-x" onClick={onClose}>{I.x}</button>
        </div>

        <div className="doc-list">
          {docs.map(d=>(
            <div key={d.k} className={'doc-row '+(d.state==='ok'?'ok':(d.req?'miss':'opt'))}>
              <div className="doc-ic">{d.state==='ok'? I.check : I.doc}</div>
              <div className="doc-body">
                <div className="doc-nm">
                  {d.name}
                  <span className={'doc-tag '+(d.req?'req':'opt')}>{d.req?'필수':'선택'}</span>
                </div>
                <div className="doc-note">{d.note}</div>
              </div>
              {d.state==='ok'
                ? <span className="doc-done">{I.check} 첨부됨</span>
                : <button className="doc-add" onClick={()=>attach(d.k)}>{I.plus} 추가</button>}
            </div>
          ))}
        </div>

        <div className="sheet-drop">
          <button className="drop-b" onClick={()=>{const m=missingReq[0]; if(m) attach(m.k);}}>{I.cam}<span>촬영</span></button>
          <button className="drop-b" onClick={()=>{const m=missingReq[0]; if(m) attach(m.k);}}>{I.upload}<span>파일 선택</span></button>
        </div>

        <div className="sheet-f">
          <div className="sheet-stat">
            {ready
              ? <span className="ok">{I.check} 필수 문서 모두 첨부됨</span>
              : <span className="miss">{I.alert} 필수 {missingReq.length}건 남음</span>}
          </div>
          <button className={'sheet-go'+(ready?'':' off')} disabled={!ready}
            onClick={()=>onDone(c.id)}>문서 첨부 완료 {I.arrow}</button>
        </div>
      </div>
    </div>
  );
}

function App(){
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(null);
  const [resolved, setResolved] = useState({});
  const eff = c => resolved[c.id]
    ? {...c, doc:{state:'ok', label:'문서 확인 완료', detail:'방금 첨부됨 · 검토 대기'}}
    : c;
  const CASES_E = CASES.map(eff);
  const counts = {
    all: CASES_E.length,
    blocked: CASES_E.filter(c=>statusOf(c)==='blocked').length,
    ready: CASES_E.filter(c=>statusOf(c)==='ready').length,
  };
  // 문서 대기 먼저, 반영 가능 다음
  const rank = {blocked:0, ready:1};
  let list = [...CASES_E].sort((a,b)=>rank[statusOf(a)]-rank[statusOf(b)]);
  if(filter!=='all') list = list.filter(c=> statusOf(c)===filter);

  const blockedN = counts.blocked;

  return (
    <div className="stage">
      <div>
        <div className="phone"><div className="screen">
          <div className="notch"></div>

          <div className="statusbar">
            <span>9:41</span>
            <span className="sb-r">
              <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1"/><rect x="9" y="2" width="3" height="10" rx="1"/><rect x="13.5" y="0" width="3" height="12" rx="1" opacity=".4"/></svg>
              <svg width="22" height="12" viewBox="0 0 22 12" fill="none"><rect x="1" y="1" width="18" height="10" rx="3" stroke="currentColor" strokeWidth="1.2" opacity=".5"/><rect x="2.5" y="2.5" width="13" height="7" rx="1.5" fill="currentColor"/><rect x="20" y="4" width="1.6" height="4" rx="1" fill="currentColor" opacity=".5"/></svg>
            </span>
          </div>

          <div className="appbar">
            <div className="appbar-top">
              <span className="brand"><span className="mk">L</span>LabAxis</span>
              <span className="sp"></span>
              <button className="ic">{I.search}</button>
              <button className="ic scan">{I.scan}</button>
              <button className="ic">{I.menu}</button>
            </div>
          </div>

          <div className="body">
            <div className="phead">
              <h1>입고 관리</h1>
              <p className="sub">문서만 채우면 재고에 반영됩니다</p>
              <div className="sumstrip">
                <div className="sumcard alert">
                  <div className="n">{blockedN}<small>건</small></div>
                  <div className="lb">{I.doc} 문서 대기</div>
                </div>
                <div className="sumcard">
                  <div className="n">{counts.ready}<small>건</small></div>
                  <div className="lb">{I.check} 반영 가능</div>
                </div>
              </div>
            </div>

            <div className="chiprow">
              {FILTERS.map(f=>(
                <button key={f.k} className={'chip'+(f.danger?' danger':'')+(filter===f.k?' on':'')}
                  onClick={()=>setFilter(f.k)}>
                  {f.label}<span className="c">{counts[f.k]}</span>
                </button>
              ))}
            </div>

            <div className="queue">
              {list.map(c=> <Case key={c.id} c={c} onAction={()=>{
                if(statusOf(c)!=='ready') setSheet(c);
              }} />)}
            </div>
          </div>

          <div className="tabbar">
            <a className="tab" href="../dashhome/메인 대시보드 모바일.html" style={{cursor:'pointer',textDecoration:'none',color:'inherit'}}><span>{I.grid}</span>대시보드</a>
            <a className="tab" href="../quote/견적 관리 모바일.html" style={{cursor:'pointer',textDecoration:'none',color:'inherit'}}><span>{I.doc}</span>견적</a>
            <div className="tab on"><span>{I.inbox}</span>입고</div>
            <a className="tab" href="../inventory/재고 관리 모바일.html" style={{cursor:'pointer',textDecoration:'none',color:'inherit'}}><span>{I.box}</span>재고</a>
            <div className="tab"><span>{I.more}</span>더보기</div>
          </div>

          {sheet && <DocSheet c={sheet} onClose={()=>setSheet(null)}
            onDone={(id)=>{ setResolved(r=>({...r,[id]:true})); setSheet(null); }} />}

        </div></div>
        <div className="phone-cap">입고 관리 — 모바일 (개선안)</div>
      </div>

      <div className="notes">
        <h2>무엇이 바뀌었나</h2>
        <p className="nsub">검수·격리는 QR로 분리 · 이 화면은 문서 한 가지에 집중</p>
        <div className="note">
          <div className="nh"><span className="nnum">1</span>입고 1건 = 카드 1장</div>
          <p>입고 한 건이 문서·검수로 여러 줄 흩어지던 걸 <b>한 카드</b>로 묶음. 카드 수 = 처리할 입고 수.</p>
        </div>
        <div className="note">
          <div className="nh"><span className="nnum">2</span>게이트는 '문서' 하나</div>
          <p>검수·격리는 <b>상단 QR 스캔</b>이 처리. 이 화면에 남는 건 <b>성적서·MSDS 같은 문서</b> 하나뿐 — 채우면 바로 <b>"재고 반영"</b>.</p>
        </div>
        <div className="note">
          <div className="nh"><span className="nnum">3</span>상태는 두 가지뿐</div>
          <p><b>문서 대기</b> → <b>반영 가능</b>. 진행 중·시급도 같은 축을 없애 한눈에 들어옴. 상단 칩은 <b>필터로만</b> 동작.</p>
        </div>
        <div className="note">
          <div className="nh"><span className="nnum">4</span>문서 첨부는 시트로</div>
          <p>"문서 첨부"를 누르면 <b>필수 문서 체크 + 촬영·파일</b> 바텀시트. 필수 모두 채우면 <b>검토로 넘김</b>까지 한 흐름.</p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
