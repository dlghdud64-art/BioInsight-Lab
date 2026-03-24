import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";

export default function OperationsPolicyPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="mb-10 border-b border-[#1E2D40] pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">LabAxis 운영정책</h1>
          <div className="flex flex-wrap gap-3 text-xs text-[#8794AA]">
            <span>시행일: 2026.03.24</span><span>·</span><span>최종 개정일: 2026.03.24</span><span>·</span><span>버전: v1.0</span>
          </div>
        </div>
        <div className="space-y-10 text-sm md:text-[15px] leading-relaxed text-[#BAC6D9]">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제1조 (목적)</h2>
            <p>이 운영정책은 LabAxis 서비스의 안정적 운영, 정보보호, 조직 데이터 보호, 공정한 이용질서 유지를 위해 회원이 준수해야 할 세부 운영 기준과 회사의 제재 기준을 정하는 것을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제2조 (적용 대상)</h2>
            <p>이 정책은 LabAxis를 이용하는 모든 회원, 조직 관리자, 초대 사용자, 승인권자, 외부 협업 계정, 유료 플랜 이용조직 및 서비스 연동 계정에 적용됩니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제3조 (운영 원칙)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>LabAxis는 연구 구매 운영 업무를 위한 B2B 서비스입니다.</li>
              <li>회사는 서비스 안정성, 데이터 무결성, 보안, 협업 책임성, 감사 가능성을 중요 원칙으로 운영합니다.</li>
              <li>조직 관리자는 자신의 워크스페이스 내 권한, 승인체계, 문서 접근범위, 외부 공유범위 설정에 대한 1차 관리 책임을 집니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제4조 (허용되는 사용)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>시약·장비 검색 및 비교</li>
              <li>견적 요청, 회신 정리, 발주 및 입고 기록 관리</li>
              <li>재고 현황, 사용 기록, 운영 이력 관리</li>
              <li>워크스페이스 기반 협업, 승인 흐름, 문서 보관</li>
              <li>AI 기능을 이용한 요약, 정리, 추천 등 업무 보조</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제5조 (금지행위)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>타인의 계정 또는 권한을 도용하거나 무단 사용하는 행위</li>
              <li>허위 견적 요청, 허위 발주, 허위 입고·재고 데이터를 생성하거나 유지하는 행위</li>
              <li>회사 또는 제3자의 시스템에 비정상적인 부하를 유발하는 행위</li>
              <li>악성코드, 스크립트, 자동화 도구를 이용하여 서비스에 위해를 가하는 행위</li>
              <li>취약점 탐지, 권한 우회, 무단 접근, 리버스 엔지니어링 등 보안 침해 행위</li>
              <li>개인정보, 영업비밀, 기밀자료를 적법한 권한 없이 업로드·공유·전송하는 행위</li>
              <li>법령에 위반되는 문서, 침해자료, 불법 거래 관련 자료를 업로드하는 행위</li>
              <li>AI 기능을 이용하여 허위 사실 생성, 규정 회피, 기만, 불법행위를 시도하는 행위</li>
              <li>회사의 승인 없이 경쟁 서비스 개발, 대량 데이터 추출, 상업적 재판매를 목적으로 서비스를 사용하는 행위</li>
              <li>기타 이용약관, 개인정보처리방침 또는 관련 법령에 위반되는 행위</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제6조 (업로드 자료와 문서 관리)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회원은 업로드 자료에 대하여 적법한 권한을 보유하여야 하며, 기밀성 수준에 맞는 업로드·공유 범위를 설정하여야 합니다.</li>
              <li>조직 관리자는 퇴사자 계정, 협력사 계정, 외부 공유 문서, 승인 완료 문서의 접근권한을 주기적으로 점검하여야 합니다.</li>
              <li>회사는 보안, 법령 준수, 권리침해 대응을 위하여 필요 시 특정 문서 또는 링크 접근을 일시 제한할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제7조 (AI 기능 운영 기준)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>AI 기능은 참고용 보조 도구이며, 최종 의사결정을 대체하지 않습니다.</li>
              <li>회원은 민감정보, 불필요한 개인정보, 제3자의 비공개 기밀정보를 AI 기능 입력에 사용하지 않도록 주의하여야 합니다.</li>
              <li>회사는 서비스 품질과 안전성 확보를 위하여 AI 기능 사용 로그를 점검할 수 있습니다.</li>
              <li>AI 기능 결과에 대한 업무 적용 여부와 책임은 회원 및 해당 조직에 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">제8조 (제재 기준)</h2>
            <p className="mb-3">회사는 위반의 정도, 반복성, 고의성, 보안 영향, 법령 위반 가능성 등을 고려하여 다음 조치를 할 수 있습니다.</p>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs md:text-sm border-collapse min-w-[400px]">
                <thead><tr className="border-b-2 border-[#26364C] text-left text-[#8794AA]"><th className="py-2 px-3">단계</th><th className="py-2 px-3">조치 내용</th></tr></thead>
                <tbody className="text-[#BAC6D9]">
                  <tr className="border-b border-[#1E2D40]"><td className="py-2 px-3 text-white font-medium">1단계</td><td className="py-2 px-3">경고 또는 시정 요청</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2 px-3 text-white font-medium">2단계</td><td className="py-2 px-3">일부 기능 제한</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2 px-3 text-white font-medium">3단계</td><td className="py-2 px-3">계정 일시 정지</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2 px-3 text-white font-medium">4단계</td><td className="py-2 px-3">워크스페이스 일부 또는 전체 제한</td></tr>
                  <tr className="border-b border-[#1E2D40]"><td className="py-2 px-3 text-white font-medium">5단계</td><td className="py-2 px-3">영구 이용제한 또는 계약 해지</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[#8794AA]">보안 침해, 법령 위반, 중대한 서비스 위험 초래 시 사전 경고 없이 즉시 제한할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제9조 (이의제기 및 소명)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회원은 제재 조치에 대하여 회사가 안내하는 채널을 통해 이의제기 또는 소명자료를 제출할 수 있습니다.</li>
              <li>회사는 합리적인 범위에서 소명자료를 검토하고 결과를 회신합니다.</li>
              <li>긴급성이 높거나 보안 이슈가 있는 경우 사후 검토 방식으로 대응할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제10조 (장애, 점검, 공지 및 지원)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회사는 안정적 운영을 위해 정기점검 또는 임시점검을 수행할 수 있습니다.</li>
              <li>장애, 지연, 데이터 동기화 문제 등이 발생한 경우 서비스 내 공지, 이메일 등으로 안내합니다.</li>
              <li>고객지원 범위, 응답 시간, 우선순위는 플랜 또는 별도 지원정책에 따라 달라질 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제11조 (정책의 변경)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회사는 서비스 운영상 필요에 따라 본 정책을 변경할 수 있습니다.</li>
              <li>중대한 영향을 미치는 변경은 시행 전 사전 공지합니다.</li>
              <li>변경된 정책 시행 이후 서비스를 계속 이용하는 경우 변경 내용에 동의한 것으로 봅니다.</li>
            </ol>
          </section>

          <section className="border-t border-[#1E2D40] pt-6">
            <h2 className="text-lg font-bold text-white mb-3">부칙</h2>
            <p>이 운영정책은 2026년 3월 24일부터 시행합니다.</p>
          </section>

        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
