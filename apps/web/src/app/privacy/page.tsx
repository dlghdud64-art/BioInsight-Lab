import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">개인정보 처리방침</h1>
            <p className="text-muted-foreground">
              최종 업데이트: 2024년 12월 11일
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>제1조 (개인정보의 처리 목적)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                BioInsight Lab(이하 "회사")은 다음의 목적을 위하여 개인정보를 처리합니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-2">
                <li>서비스 제공 및 계약의 이행</li>
                <li>회원 관리 및 본인 확인</li>
                <li>서비스 개선 및 신규 서비스 개발</li>
                <li>고객 문의 및 불만 처리</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제2조 (개인정보의 처리 및 보유기간)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 
                동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제3조 (처리하는 개인정보의 항목)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">회사는 다음의 개인정보 항목을 처리합니다:</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>필수항목:</strong> 이메일, 이름</p>
                <p><strong>선택항목:</strong> 프로필 이미지, 조직명</p>
                <p><strong>자동 수집 항목:</strong> IP 주소, 쿠키, 서비스 이용 기록</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제4조 (개인정보의 제3자 제공)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 
                다만, 다음의 경우에는 예외로 합니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-2">
                <li>이용자가 사전에 동의한 경우</li>
                <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제5조 (개인정보의 파기)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 
                지체없이 해당 개인정보를 파기합니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제6조 (정보주체의 권리·의무 및 행사방법)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                정보주체는 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-2">
                <li>개인정보 열람 요구</li>
                <li>오류 등이 있을 경우 정정 요구</li>
                <li>삭제 요구</li>
                <li>처리정지 요구</li>
              </ul>
            </CardContent>
          </Card>

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
                <p><strong>이메일:</strong> <a href="mailto:contact@bioinsight.lab" className="text-primary hover:underline">contact@bioinsight.lab</a></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}

