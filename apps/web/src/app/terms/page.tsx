import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">이용 약관</h1>
            <p className="text-muted-foreground">
              최종 업데이트: 2024년 12월 11일
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>제1조 (목적)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                본 약관은 BioInsight Lab(이하 "회사")이 제공하는 서비스의 이용과 관련하여 
                회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제2조 (정의)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. "서비스"란 회사가 제공하는 바이오·제약 시약·장비 검색·비교·견적 플랫폼을 의미합니다.</p>
              <p>2. "이용자"란 본 약관에 동의하고 서비스를 이용하는 자를 의미합니다.</p>
              <p>3. "콘텐츠"란 서비스를 통해 제공되는 모든 정보, 데이터, 텍스트, 이미지 등을 의미합니다.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제3조 (서비스의 제공)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                회사는 다음과 같은 서비스를 제공합니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-2">
                <li>제품 검색 및 비교 서비스</li>
                <li>견적 리스트 생성 및 관리 서비스</li>
                <li>예산 관리 및 리포트 서비스</li>
                <li>기타 회사가 추가로 제공하는 서비스</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제4조 (이용자의 의무)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                이용자는 다음 행위를 하여서는 안 됩니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-2">
                <li>타인의 정보를 도용하거나 부정하게 사용하는 행위</li>
                <li>서비스의 안정적 운영을 방해하는 행위</li>
                <li>법령 및 본 약관을 위반하는 행위</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>제5조 (면책사항)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 
                서비스 제공에 관한 책임이 면제됩니다. 또한 회사는 이용자의 귀책사유로 인한 서비스 이용의 
                장애에 대하여는 책임을 지지 않습니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>문의</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                본 약관에 대한 문의사항이 있으시면 <a href="mailto:contact@bioinsight.lab" className="text-primary hover:underline">contact@bioinsight.lab</a>으로 연락주세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}

