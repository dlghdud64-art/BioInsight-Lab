import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";

export default function TermsPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Document header */}
        <div className="mb-10 border-b border-[#1E2D40] pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">LabAxis 이용약관</h1>
          <div className="flex flex-wrap gap-3 text-xs text-[#8794AA]">
            <span>시행일: 2026.03.24</span>
            <span>·</span>
            <span>최종 개정일: 2026.03.24</span>
            <span>·</span>
            <span>버전: v1.0</span>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-10 text-sm md:text-[15px] leading-relaxed text-[#BAC6D9]">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제1조 (목적)</h2>
            <p>이 약관은 LabAxis(이하 &quot;회사&quot;)가 제공하는 LabAxis 서비스 및 이에 부수하는 제반 서비스의 이용과 관련하여, 회사와 회원 간의 권리, 의무 및 책임사항, 서비스 이용조건 및 절차 등 기본적인 사항을 정하는 것을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제2조 (정의)</h2>
            <p className="mb-2">이 약관에서 사용하는 용어의 뜻은 다음과 같습니다.</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li><strong className="text-white">&quot;서비스&quot;</strong>란 회사가 웹, 앱 또는 기타 전자적 방식으로 제공하는 LabAxis 및 관련 제반 기능을 의미합니다.</li>
              <li><strong className="text-white">&quot;회원&quot;</strong>이란 이 약관에 동의하고 회사와 서비스 이용계약을 체결한 자를 의미합니다.</li>
              <li><strong className="text-white">&quot;워크스페이스&quot;</strong>란 조직 단위로 서비스 데이터를 생성, 관리, 열람, 협업하기 위한 운영 공간을 의미합니다.</li>
              <li><strong className="text-white">&quot;조직 관리자&quot;</strong>란 워크스페이스 개설, 멤버 초대·삭제, 권한 부여, 결제 및 플랜 관리 등 관리 권한을 가진 회원을 의미합니다.</li>
              <li><strong className="text-white">&quot;승인권자&quot;</strong>란 견적 요청, 발주, 입고 승인 등 특정 업무 승인 권한을 가진 회원을 의미합니다.</li>
              <li><strong className="text-white">&quot;콘텐츠&quot;</strong>란 회원이 서비스 내에 입력, 업로드, 저장, 공유하는 문서, 파일, 텍스트, 이미지, 수치, 거래기록, 재고기록 기타 일체의 자료를 의미합니다.</li>
              <li><strong className="text-white">&quot;AI 기능&quot;</strong>이란 서비스 내에서 제공되는 자동 요약, 분류, 추천, 정리, 비교 보조 등 인공지능 기반 기능을 의미합니다.</li>
              <li><strong className="text-white">&quot;유료 서비스&quot;</strong>란 회사가 별도 조건과 요금에 따라 제공하는 서비스 또는 기능을 의미합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제3조 (약관의 게시와 개정)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면 또는 연결화면에 게시합니다.</li>
              <li>회사는 관련 법령을 위반하지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
              <li>회사가 약관을 개정하는 경우 시행일과 개정사유를 명시하여 시행일 7일 전부터 공지합니다. 다만 회원에게 불리한 변경은 시행일 30일 전부터 공지합니다.</li>
              <li>회원이 개정 약관 시행일까지 명시적으로 거부 의사를 표시하지 않고 서비스를 계속 이용하는 경우, 개정 약관에 동의한 것으로 봅니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제4조 (이용계약의 성립)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>이용계약은 회원이 약관에 동의하고 회사가 정한 가입절차를 완료한 후, 회사가 이를 승낙함으로써 성립합니다.</li>
              <li>회사는 다음 각 호의 경우 이용신청의 승낙을 유보하거나 거절할 수 있습니다.
                <ul className="list-disc pl-5 mt-1 space-y-1 text-[#8794AA]">
                  <li>허위 정보 또는 타인 정보를 이용한 경우</li>
                  <li>서비스의 안정적 운영을 현저히 저해할 우려가 있는 경우</li>
                  <li>법령 또는 공서양속에 반하는 목적이 있는 경우</li>
                  <li>기타 회사의 합리적 기준에 비추어 승낙이 부적절한 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제5조 (계정, 워크스페이스 및 조직 관리자)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회원은 자신의 계정 정보를 정확하게 관리하여야 하며, 계정의 무단 사용으로 발생한 문제에 대해 즉시 회사에 알려야 합니다.</li>
              <li>워크스페이스는 조직 관리자에 의해 생성되며, 조직 관리자는 멤버 권한, 승인 라인, 데이터 접근 범위 및 퇴사자 계정 정리 등 관리 책임을 부담합니다.</li>
              <li>조직 관리자는 멤버에게 역할과 권한을 부여할 수 있으며, 권한 오설정 또는 관리 소홀로 인한 내부 분쟁이나 정보노출에 대해 회사는 책임을 지지 않습니다.</li>
              <li>회사는 보안 또는 운영상 필요하다고 판단하는 경우 특정 권한 구조를 제한하거나 추가 인증 절차를 요구할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제6조 (서비스의 내용)</h2>
            <p className="mb-2">회사는 회원에게 다음 각 호의 서비스를 제공합니다.</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>시약·장비 검색 및 정보 열람</li>
              <li>후보 품목 비교 및 정리</li>
              <li>견적 요청서 작성, 요청 및 회신 관리</li>
              <li>발주, 입고, 재고 등록 및 관리</li>
              <li>워크스페이스 기반 멤버 협업, 권한·승인 관리</li>
              <li>운영 로그, 알림, 상태 추적, 문서 첨부 및 이력 관리</li>
              <li>AI 기능을 통한 요약, 정리, 추천, 비교 보조</li>
              <li>기타 회사가 추가로 정하는 서비스</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제7조 (서비스 변경, 점검 및 중단)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회사는 서비스 고도화, 보안 강화, 정책 변경, 시스템 점검 등을 위해 서비스의 전부 또는 일부를 변경할 수 있습니다.</li>
              <li>회사는 정기점검 또는 긴급점검이 필요한 경우 사전에 공지하되, 긴급한 장애·보안 이슈의 경우 사후 공지할 수 있습니다.</li>
              <li>회사는 천재지변, 설비 장애, 트래픽 폭주, 외부 연동 장애, 제휴 종료 등 불가피한 사유가 있는 경우 서비스의 전부 또는 일부를 제한 또는 중단할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제8조 (회원의 의무)</h2>
            <p className="mb-2">회원은 다음 각 호의 행위를 하여서는 안 됩니다.</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>허위 또는 부정확한 회원정보, 거래정보, 재고정보를 입력하는 행위</li>
              <li>타인의 계정, 권한 또는 인증수단을 도용하거나 무단 사용하는 행위</li>
              <li>회사 또는 제3자의 지식재산권, 영업비밀, 개인정보 기타 권리를 침해하는 행위</li>
              <li>악성코드, 비정상 트래픽, 자동화 남용, 크롤링 등으로 서비스 안정성을 저해하는 행위</li>
              <li>법령 위반, 불법 거래, 허위 견적 요청, 허위 발주, 기만적 거래기록 생성 행위</li>
              <li>승인 없이 제3자의 기밀자료 또는 개인정보가 포함된 문서를 업로드·공유하는 행위</li>
              <li>AI 기능을 이용하여 허위 사실 생성, 기만, 규정 위반, 불법 행위를 시도하는 행위</li>
              <li>기타 회사의 운영정책 또는 관련 법령에 위반되는 행위</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제9조 (콘텐츠 및 데이터)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회원이 서비스에 업로드하거나 입력한 콘텐츠의 권리와 책임은 원칙적으로 해당 회원 또는 회원이 속한 조직에 있습니다.</li>
              <li>회원은 콘텐츠를 업로드하거나 입력할 적법한 권한을 보유해야 하며, 제3자의 권리를 침해해서는 안 됩니다.</li>
              <li>회사는 법령, 약관, 운영정책 위반 여부 확인, 서비스 운영 및 보안 조치를 위하여 필요한 범위 내에서 콘텐츠를 처리할 수 있습니다.</li>
              <li>회사는 회원 콘텐츠를 회원의 명시적 승인 없이 대외적으로 공개하지 않습니다. 다만 법령에 따른 요청, 권리침해 대응, 보안 대응 등 정당한 사유가 있는 경우는 예외로 합니다.</li>
              <li>회원은 서비스 해지 또는 계약 종료 전에 필요한 데이터를 스스로 백업하여야 합니다. 회사는 합리적 범위 내에서 데이터 내보내기 또는 제공 절차를 운영할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제10조 (AI 기능 관련 사항)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>AI 기능은 회원의 업무를 보조하기 위한 참고 기능이며, 법률, 회계, 규제, 안전성, 구매 적정성 또는 공급사 검증에 대한 최종 판단을 대체하지 않습니다.</li>
              <li>회원은 AI 기능의 결과를 실제 업무에 반영하기 전에 스스로 검토·확인하여야 합니다.</li>
              <li>회사는 AI 기능 결과의 완전성, 정확성, 최신성, 특정 목적 적합성을 보증하지 않습니다.</li>
              <li>회원은 민감정보, 불필요한 개인정보, 제3자의 기밀정보를 AI 기능 입력에 사용하지 않도록 주의하여야 합니다.</li>
              <li>회사는 서비스 품질 개선과 안전성 점검을 위해 AI 입력·출력 로그를 법령과 방침에 따라 처리할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제11조 (유료 서비스, 과금 및 환불)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회사는 유료 서비스의 종류, 요금, 결제주기, 제공범위, 사용량 제한 등을 서비스 화면 또는 별도 안내문에서 정합니다.</li>
              <li>유료 서비스가 아직 개시되지 않은 경우, 회사는 향후 유료 서비스 도입 시 별도 고지 또는 약관 개정을 통해 세부 조건을 정할 수 있습니다.</li>
              <li>유료 서비스가 개시된 경우 회원은 고지된 요금 및 조건에 따라 결제하여야 합니다.</li>
              <li>정기결제, 자동갱신, 결제 실패, 미납, 해지, 이용정지, 환불 및 청약철회 기준은 관련 법령과 회사의 별도 결제정책에 따릅니다.</li>
              <li>회사는 부정 사용, 결제 사기, 약관 위반이 확인되는 경우 유료 서비스 이용을 제한할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제12조 (지식재산권)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>서비스 자체와 회사가 작성한 콘텐츠, UI, 로고, 상표, 소프트웨어, 데이터베이스 등의 지식재산권은 회사 또는 정당한 권리자에게 귀속됩니다.</li>
              <li>회원은 회사의 사전 서면 동의 없이 서비스를 복제, 배포, 전송, 2차적 저작물 작성, 역설계, 판매, 임대하거나 영리 목적으로 이용할 수 없습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제13조 (이용제한 및 계약해지)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회사는 회원이 이 약관, 운영정책 또는 법령을 위반한 경우 경고, 기능 제한, 계정 일시정지, 워크스페이스 제한, 영구 이용제한 등의 조치를 할 수 있습니다.</li>
              <li>보안 침해, 법령 위반, 타인 권리침해, 서비스 남용 등 긴급한 사유가 있는 경우 회사는 사전 통지 없이 즉시 제한 조치를 취할 수 있습니다.</li>
              <li>회원은 언제든지 회사가 정한 절차에 따라 이용계약 해지를 신청할 수 있습니다.</li>
              <li>이용계약 해지 또는 서비스 종료 시 데이터 보관기간, 파기, 백업 제공 여부는 개인정보처리방침 및 별도 안내에 따릅니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제14조 (면책)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>회사는 천재지변, 불가항력, 회원 귀책, 제3자 서비스 장애, 통신망 장애 등 회사의 합리적 통제 범위를 벗어난 사유로 인한 손해에 대해 책임을 지지 않습니다.</li>
              <li>회사는 회원이 입력·업로드한 정보, 제3자 공급사 정보, 외부 링크 또는 AI 기능 결과의 정확성·적합성에 대해 보증하지 않습니다.</li>
              <li>회사는 회원 간 또는 회원과 제3자 간 분쟁에 개입할 의무가 없으며, 이로 인한 손해에 대해 책임을 지지 않습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">제15조 (준거법 및 분쟁해결)</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>이 약관은 대한민국 법률에 따라 해석되고 적용됩니다.</li>
              <li>서비스 이용과 관련하여 회사와 회원 간 분쟁이 발생한 경우, 당사자는 상호 협의하여 해결하도록 노력합니다.</li>
              <li>협의가 이루어지지 않는 경우 관할 법원은 민사소송법 등 관계 법령에 따릅니다.</li>
            </ol>
          </section>

          <section className="border-t border-[#1E2D40] pt-6">
            <h2 className="text-lg font-bold text-white mb-3">부칙</h2>
            <p>이 약관은 2026년 3월 24일부터 시행합니다.</p>
          </section>

        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
