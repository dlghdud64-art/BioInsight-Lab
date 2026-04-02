import Spline from '@splinetool/react-spline/next';

export default function Home() {
  return (
    <main className="relative bg-[#020617] font-sans text-white min-h-screen">

      {/* =========================================
          1. HERO SECTION (Spline 3D 배경 + 타이틀)
          ========================================= */}
      <section className="relative w-full bg-[#0f172a] flex flex-col overflow-hidden pb-40 border-b border-slate-800">

        {/* 🔥 Spline 3D 배경 영역 */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          {/* 중앙 광원 (텍스트 가독성을 위해 유지) */}
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[60vh] bg-blue-500/15 rounded-full blur-[120px] z-10"></div>

          {/* 가장자리가 부드럽게 배경색에 녹아들도록 그라데이션 적용 */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,#0f172a_90%)] z-10"></div>

          {/* Spline 모델 (마우스 인터랙션을 위해 pointer-events-auto 부여) */}
          <div className="absolute inset-0 z-0 opacity-90 pointer-events-auto">
            <Spline
              scene="https://prod.spline.design/3-TSsusHB8uIi8Ey/scene.splinecode"
            />
          </div>
        </div>

        {/* Top Navigation */}
        <nav className="relative z-20 flex justify-between items-center px-6 lg:px-12 py-5 max-w-[1400px] w-full mx-auto pointer-events-auto">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-white">LabAxis</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden md:block">요금 &amp; 도입</button>
            <button className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden md:block">로그인</button>
            <button className="bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold px-5 py-2.5 rounded-md transition-all shadow-lg">
              데모 신청
            </button>
          </div>
        </nav>

        {/* Hero Title & CTA */}
        <div className="relative z-20 flex flex-col items-center justify-center max-w-5xl mx-auto px-6 pt-20 pb-8 text-center w-full pointer-events-none">
          <p className="text-blue-400 font-extrabold text-[11px] tracking-[0.25em] mb-6 drop-shadow-sm pointer-events-auto">
            BIOTECH PROCUREMENT OPERATIONS PLATFORM
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-[64px] font-extrabold tracking-tight leading-[1.15] text-white mb-6 drop-shadow-[0_0_40px_rgba(255,255,255,0.2)] pointer-events-auto">
            연구 구매 운영을 위한<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              단 하나의 자율형 OS
            </span>
          </h1>
          <p className="text-base md:text-xl text-slate-300 mb-10 font-medium leading-relaxed max-w-2xl drop-shadow-md pointer-events-auto">
            검색, 견적, 발주부터 입고, 재고 관리까지.<br />
            파편화된 바이오 연구실의 데이터를 하나의 파이프라인으로 연결합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pointer-events-auto">
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-lg font-bold text-[15px] flex items-center justify-center gap-2 transition-all shadow-[0_0_25px_rgba(59,130,246,0.5)] border border-blue-400">
              시작하기
            </button>
            <button className="bg-[#1e293b]/80 backdrop-blur-md hover:bg-[#334155] text-white border border-slate-500/80 px-8 py-4 rounded-lg font-bold text-[15px] flex items-center justify-center gap-2 transition-all shadow-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              작동 방식 보기
            </button>
          </div>
        </div>
      </section>

      {/* =========================================
          2. UI MOCKUP SECTION (3D 배경과 자연스럽게 겹침)
          ========================================= */}
      <section className="relative z-30 w-full max-w-6xl mx-auto px-4 -mt-32 pb-24">

        {/* 대시보드 UI 목업 컨테이너 */}
        <div className="relative rounded-xl bg-[#0f172a] border border-slate-600/80 shadow-[0_30px_60px_rgba(0,0,0,0.6),0_0_50px_rgba(59,130,246,0.15)] overflow-hidden flex flex-col transform transition-transform hover:-translate-y-2 duration-500">

          {/* Mockup Header */}
          <div className="h-12 bg-[#1e293b]/90 border-b border-slate-700/80 flex items-center px-4 backdrop-blur-md">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
            </div>
            <div className="mx-auto flex items-center gap-2 px-8 w-full max-w-md">
              <div className="w-full bg-[#0f172a] border border-slate-700 text-xs text-slate-400 px-4 py-1.5 rounded-md flex items-center gap-2 shadow-inner">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                시약, 장비 또는 벤더 검색 (⌘K)
              </div>
            </div>
          </div>

          {/* Mockup Body */}
          <div className="flex h-[450px] bg-[#020617]">
            {/* Sidebar */}
            <div className="w-56 border-r border-slate-800 bg-[#0f172a]/80 p-4 hidden md:flex flex-col gap-1 backdrop-blur-md">
              <div className="text-[10px] font-bold text-slate-500 mb-2 pl-2 tracking-widest mt-2">OPERATIONS</div>
              <div className="text-xs font-semibold text-white bg-blue-600/20 border border-blue-500/30 text-blue-400 py-2.5 px-3 rounded-md flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                  <span>발주 파이프라인</span>
                </div>
                <span className="bg-blue-600 text-white px-1.5 rounded text-[10px] font-bold">12</span>
              </div>
              <div className="text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 py-2.5 px-3 rounded-md cursor-pointer flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                견적 비교실
              </div>

              <div className="text-[10px] font-bold text-slate-500 mt-6 mb-2 pl-2 tracking-widest">INVENTORY</div>
              <div className="text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 py-2.5 px-3 rounded-md cursor-pointer flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                입고 검수 대기
              </div>
              <div className="text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 py-2.5 px-3 rounded-md cursor-pointer flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                통합 재고 관리
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 md:p-8 overflow-hidden bg-[#020617] relative">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 border-b border-slate-800 pb-4 gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-white mb-1">발주 대기 파이프라인</h2>
                  <p className="text-sm text-slate-400">결재 승인이 완료되어 발주서 전송이 필요한 항목입니다.</p>
                </div>
                <button className="bg-white hover:bg-slate-200 text-slate-900 text-xs font-bold px-4 py-2 rounded-md shadow transition-colors w-fit">
                  일괄 발주 처리 (3)
                </button>
              </div>

              {/* Data Items */}
              <div className="space-y-4">
                {/* Item 1 */}
                <div className="bg-[#0f172a] border border-slate-700/80 p-4 rounded-xl flex items-center justify-between hover:border-blue-500/50 transition-colors group cursor-pointer shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-600 group-hover:bg-blue-900/30 transition-colors hidden sm:flex">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6 15.428a2 2 0 00-1.022.547l-2.387.477a6 6 0 00-3.86-.517l-.318-.158a6 6 0 01-3.86-.517L6 15.428"></path></svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-[15px] font-bold text-white">Fetal Bovine Serum, 500mL</h3>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">팀장 승인 완료</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Thermo Fisher</span>
                        <span className="hidden sm:inline">&bull;</span>
                        <span className="hidden sm:inline">REQ-2026-0412</span>
                        <span className="hidden sm:inline">&bull;</span>
                        <span className="hidden sm:inline">요청자: 김연구</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-white">&yen; 420,000</p>
                    <p className="text-xs text-slate-500 mt-1 hidden sm:block">예산: 세포배양 연구비 (80% 잔여)</p>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="bg-[#0f172a] border border-slate-700/80 p-4 rounded-xl flex items-center justify-between hover:border-blue-500/50 transition-colors group cursor-pointer shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-600 group-hover:bg-purple-900/30 transition-colors hidden sm:flex">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-[15px] font-bold text-white">Pipette Tips, 200uL, Sterile</h3>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">팀장 승인 완료</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Eppendorf</span>
                        <span className="hidden sm:inline">&bull;</span>
                        <span className="hidden sm:inline">REQ-2026-0415</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-white">&yen; 85,000</p>
                    <p className="text-xs text-slate-500 mt-1 hidden sm:block">예산: 공통 소모품비 (45% 잔여)</p>
                  </div>
                </div>

              </div>

              {/* Fade Out Gradient at bottom */}
              <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#020617] to-transparent pointer-events-none"></div>
            </div>
          </div>
        </div>

        {/* =========================================
            3. SOCIAL PROOF (고객사 로고)
            ========================================= */}
        <div className="mt-16 text-center">
          <p className="text-[11px] font-bold text-slate-500 tracking-widest uppercase mb-8">혁신적인 바이오 기업과 연구소들이 선택했습니다</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale">
            <span className="text-xl font-extrabold tracking-tighter">SAMSUNG BIO</span>
            <span className="text-xl font-extrabold tracking-tighter">CELLTRION</span>
            <span className="text-xl font-extrabold tracking-tighter">SK bioscience</span>
            <span className="text-xl font-extrabold tracking-tighter">KAIST</span>
          </div>
        </div>
      </section>

      {/* =========================================
          4. OPERATIONAL VALUE SECTION
          ========================================= */}
      <section className="py-24 max-w-5xl mx-auto px-6 border-t border-slate-800/50 mt-12">
        <div className="mb-16 text-center">
          <p className="text-blue-500 font-bold text-[11px] tracking-widest uppercase mb-3">Operational Excellence</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">각 단계에서 무엇이 달라지는가</h2>
          <p className="text-base text-slate-400 max-w-2xl mx-auto">기존 수기 방식의 병목과 사각지대를 LabAxis가 어떻게 해소하는지 단계별로 증명합니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 hover:border-slate-600 transition-colors shadow-lg flex flex-col h-full group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-3">벤더 분산 탐색 제거</h3>
            <p className="text-[14px] text-slate-400 mb-6 flex-grow leading-relaxed">기존 벤더 사이트 5-10곳을 반복 접속하던 병목을 단일 통합 검색으로 해결합니다.</p>
            <div className="border-t border-slate-800 pt-5 mt-auto">
              <p className="text-[12px] font-bold text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                즉시 비교 리스트 확보 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 hover:border-slate-600 transition-colors shadow-lg flex flex-col h-full group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-3">의사결정 속도 향상</h3>
            <p className="text-[14px] text-slate-400 mb-6 flex-grow leading-relaxed">엑셀 수기 정리 대신 투명한 워크스페이스에서 팀 단위 실시간 판단이 가능합니다.</p>
            <div className="border-t border-slate-800 pt-5 mt-auto">
              <p className="text-[12px] font-bold text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                투명한 스펙/가격 비교 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 hover:border-slate-600 transition-colors shadow-lg flex flex-col h-full group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-3">커뮤니케이션 구조화</h3>
            <p className="text-[14px] text-slate-400 mb-6 flex-grow leading-relaxed">이메일 견적 요청의 한계를 벗어나 SLA 추적 및 자동 문서화를 지원합니다.</p>
            <div className="border-t border-slate-800 pt-5 mt-auto">
              <p className="text-[12px] font-bold text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                SLA 및 지연 사유 추적 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </p>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
