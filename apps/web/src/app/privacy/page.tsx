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

          <Card>
            <CardHeader>
              <CardTitle>제1조 (개인정보의 처리 목적)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                LabAxis(이하 "회사")은 다음의 목적을 위하여 개인정보를 처리합니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-2">
                <li>서비스 제공 및 계약의 이행</li>
                <li>회원 관리 및 본인 확인</li>
                <li>서비스 개선 및 신규 서비스 개발</li>
                <li>고객 문의 및 불만 처리</li>
              </ul>
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>제7조 (개인정보 보호책임자)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 
                정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
              </p>
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                <p><strong>이메일:</strong> <a href="mailto:contact@labaxis.io" className="text-primary hover:underline">contact@labaxis.io</a></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
