import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";

export default function PrivacyPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="mb-10 border-b border-[#1E2D40] pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">LabAxis 개인정보처리방침</h1>
          <div className="flex flex-wrap gap-3 text-xs text-[#8794AA]">
            <span>시행일: 2026.03.24</span><span>·</span><span>최종 개정일: 2026.03.24</span><span>·</span><span>버전: v1.0</span>
          </div>
        </div>
        <div className="space-y-10 text-sm md:text-[15px] leading-relaxed text-[#BAC6D9]">
          <p>LabAxis(이하 &quot;회사&quot;)는 개인정보 보호법 등 관련 법령에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.</p>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">1. 처리하는 개인정보의 항목, 목적, 근거 및 보유기간</h2>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs md:text-sm border-collapse min-w-[640px]">
                <thead><tr className="border-b-2 border-[#26364C] text-left text-[#8794AA]"><th className="py-2.5 px-3 font-semibold">처리 목적</th><th className="py-2.5 px-3 font-semibold">수집 항목</th><th className="py-2.5 px-3 font-semibold">처리 근거</th><th className="py-2.5 px-3 font-semibold">보유기간</th></tr></thead>
                <tbody className="text-[#BAC6D9]">
                  <tr className="border-b border-[#1E2D40]"><td className="py-2.5 px-3 text-white font-medium">회원가입 및 로그인</td><td className="py-2.5 px-3">이메일, 이름, 비밀번호(암호화), 소속 조직명, 접속기록</td><td className="py-2.5 px-3">동의, 계약 이행</td><td className="py-2.5 px-3">탈퇴 시까지 (법령상 보존 의무 시 해당 기간)</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2.5 px-3 text-white font-medium">워크스페이스 관리</td><td className="py-2.5 px-3">조직명, 부서명, 직책, 권한, 초대 이력, 관리자 설정</td><td className="py-2.5 px-3">계약 이행, 정당한 이익</td><td className="py-2.5 px-3">이용 종료 후 6개월 또는 분쟁 종결 시</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2.5 px-3 text-white font-medium">검색·비교·견적·발주·입고·재고</td><td className="py-2.5 px-3">품목명, 카탈로그번호, 제조사, 거래기록, 입고/재고, 첨부문서, 승인이력, 행동로그</td><td className="py-2.5 px-3">계약 이행</td><td className="py-2.5 px-3">이용 종료 후 6개월 (법령상 보관의무 시 해당 기간)</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2.5 px-3 text-white font-medium">고객/도입 문의</td><td className="py-2.5 px-3">이름, 회사명, 이메일, 연락처, 문의내용, 첨부파일</td><td className="py-2.5 px-3">동의, 정당한 이익</td><td className="py-2.5 px-3">완료 후 1년 또는 분쟁 해결 시</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2.5 px-3 text-white font-medium">결제·정산 (유료 개시 시)</td><td className="py-2.5 px-3">결제수단, 청구정보, 사업자정보, 거래내역</td><td className="py-2.5 px-3">계약 이행, 법령상 의무</td><td className="py-2.5 px-3">전자상거래·세무 법령 보존기간</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2.5 px-3 text-white font-medium">보안·접속기록·이상탐지</td><td className="py-2.5 px-3">IP, 접속일시, 기기/브라우저, 쿠키/세션, 이용로그</td><td className="py-2.5 px-3">정당한 이익, 법령상 의무</td><td className="py-2.5 px-3">3개월 또는 법령상 보존기간</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2.5 px-3 text-white font-medium">알림·운영 공지</td><td className="py-2.5 px-3">이메일, 알림설정, 워크스페이스/작업 상태</td><td className="py-2.5 px-3">계약 이행, 정당한 이익</td><td className="py-2.5 px-3">탈퇴 또는 수신거부 시 (필수 공지 예외)</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2.5 px-3 text-white font-medium">AI 기능 제공·품질 개선</td><td className="py-2.5 px-3">AI 입력텍스트, 출력결과, 기능사용로그, 오류정보</td><td className="py-2.5 px-3">동의 또는 계약 이행</td><td className="py-2.5 px-3">목적 달성 후 지체 없이 삭제</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section><h2 className="text-lg font-bold text-white mb-3">2. 만 14세 미만 아동</h2><p>회사는 원칙적으로 만 14세 미만 아동을 대상으로 서비스를 제공하지 않습니다.</p></section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. 제3자 제공</h2>
            <p>회사는 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법이 허용하는 경우에만 제3자에게 제공합니다. 현재 해당 없음.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. 처리 위탁</h2>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs md:text-sm border-collapse min-w-[500px]">
                <thead><tr className="border-b-2 border-[#26364C] text-left text-[#8794AA]"><th className="py-2 px-3">수탁자</th><th className="py-2 px-3">위탁 업무</th><th className="py-2 px-3">항목</th><th className="py-2 px-3">보유기간</th></tr></thead>
                <tbody className="text-[#BAC6D9]">
                  <tr className="border-b border-[#1E2D40]"><td className="py-2 px-3">[클라우드 호스팅]</td><td className="py-2 px-3">인프라·데이터 저장</td><td className="py-2 px-3">계정·이용기록</td><td className="py-2 px-3">계약 종료 시</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2 px-3">[이메일 발송]</td><td className="py-2 px-3">알림 발송</td><td className="py-2 px-3">이메일, 이름</td><td className="py-2 px-3">계약 종료 시</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#8794AA] mt-2">※ 실제 사용 업체 확정 시 업데이트</p>
          </section>

          <section><h2 className="text-lg font-bold text-white mb-3">5. 국외 이전</h2><p>현재 해당 없음. 국외 서비스 이용 확정 시 업데이트 예정입니다.</p></section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. 파기절차 및 방법</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>보유기간 경과·목적 달성 시 지체 없이 파기합니다.</li>
              <li>법령 보존 의무가 있는 경우 별도 DB로 분리 보관합니다.</li>
              <li>전자적 파일은 복구 불가 방법으로 삭제, 종이 문서는 분쇄·소각합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. 정보주체 권리 행사</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>열람, 정정·삭제, 처리정지, 동의 철회를 요구할 수 있습니다.</li>
              <li>서면, 전자우편, 고객지원 채널로 행사 가능합니다.</li>
              <li>대리인을 통한 행사가 가능합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. 안전성 확보조치</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li><strong className="text-white">관리적:</strong> 내부관리계획, 최소 권한, 접근권한 관리, 교육</li>
              <li><strong className="text-white">기술적:</strong> 암호화, 접근통제, 접속기록 보관, 보안패치, 전송구간 보호</li>
              <li><strong className="text-white">물리적:</strong> 전산실 접근통제</li>
            </ol>
          </section>

          <section><h2 className="text-lg font-bold text-white mb-3">9. 쿠키</h2><p>회사는 로그인 유지, 보안, 설정 저장을 위해 쿠키를 사용할 수 있으며, 브라우저 설정으로 거부 가능합니다.</p></section>

          <section><h2 className="text-lg font-bold text-white mb-3">10. 자동화된 결정</h2><p>AI 기능 결과는 참고 정보이며 단독 최종 의사결정으로 확정하지 않습니다. 중대한 영향이 있는 경우 법령에 따라 고지·보호조치를 마련합니다.</p></section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. 개인정보 보호책임자</h2>
            <ul className="space-y-1 pl-1"><li>· CPO: [성명 / 직책]</li><li>· 연락처: [이메일], [전화번호]</li><li>· 담당부서: [부서명]</li></ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">12. 권익침해 구제</h2>
            <ul className="space-y-1 pl-1 text-[#8794AA]">
              <li>· 개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
              <li>· 개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
              <li>· 대검찰청 (spo.go.kr / 1301)</li>
              <li>· 경찰청 사이버범죄 신고시스템 (ecrm.police.go.kr / 182)</li>
            </ul>
          </section>

          <section className="border-t border-[#1E2D40] pt-6">
            <h2 className="text-lg font-bold text-white mb-3">13. 방침 변경</h2>
            <p>이 개인정보처리방침은 2026년 3월 24일부터 시행합니다. 변경 시 시행일자와 변경사항을 공지합니다.</p>
          </section>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
