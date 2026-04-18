import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from "@react-email/components";

interface QuoteCompletedEmailProps {
  customerName: string;
  quoteNumber: string;
  completedDate: string;
  itemCount: number;
  totalAmount?: string;
  dashboardUrl?: string;
}

export function QuoteCompletedEmail({
  customerName = "고객",
  quoteNumber = "0000",
  completedDate = new Date().toLocaleDateString("ko-KR"),
  itemCount = 0,
  totalAmount,
  dashboardUrl = "https://biocompare.kr/dashboard",
}: QuoteCompletedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>견적서가 도착했습니다! - BioCompare</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>BioCompare</Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            {/* Success Icon */}
            <Section style={iconContainer}>
              <Text style={successIcon}>✓</Text>
            </Section>

            <Heading style={h1}>견적서가 도착했습니다!</Heading>

            <Text style={greeting}>
              {customerName} 님, 안녕하세요.
            </Text>

            <Text style={paragraph}>
              요청하신 견적이 <strong>완료</strong>되었습니다.
              대시보드에서 상세 내용을 확인하시고, 주문을 진행해 주세요.
            </Text>

            {/* Quote Info Box */}
            <Section style={infoBox}>
              <Row>
                <Column style={infoLabel}>견적 번호</Column>
                <Column style={infoValue}>#{quoteNumber}</Column>
              </Row>
              <Hr style={divider} />
              <Row>
                <Column style={infoLabel}>완료 일시</Column>
                <Column style={infoValue}>{completedDate}</Column>
              </Row>
              <Hr style={divider} />
              <Row>
                <Column style={infoLabel}>견적 품목</Column>
                <Column style={infoValue}>{itemCount}개 품목</Column>
              </Row>
              {totalAmount && (
                <>
                  <Hr style={divider} />
                  <Row>
                    <Column style={infoLabel}>최종 금액</Column>
                    <Column style={totalAmountValue}>{totalAmount}</Column>
                  </Row>
                </>
              )}
            </Section>

            {/* Status Timeline - Completed */}
            <Section style={timeline}>
              <Text style={timelineTitle}>진행 상태</Text>
              <Row>
                <Column style={stepCompleted}>
                  <Text style={stepNumberCompleted}>✓</Text>
                  <Text style={stepText}>접수 완료</Text>
                </Column>
                <Column style={stepLineCompleted}></Column>
                <Column style={stepCompleted}>
                  <Text style={stepNumberCompleted}>✓</Text>
                  <Text style={stepText}>검토 완료</Text>
                </Column>
                <Column style={stepLineCompleted}></Column>
                <Column style={stepActive}>
                  <Text style={stepNumberActive}>✓</Text>
                  <Text style={stepTextActive}>견적 완료</Text>
                </Column>
              </Row>
            </Section>

            <Text style={highlightBox}>
              💡 견적서 유효기간은 발행일로부터 <strong>30일</strong>입니다.
            </Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Link href={dashboardUrl} style={button}>
                대시보드에서 견적 확인하기
              </Link>
            </Section>

            <Text style={helpText}>
              견적 내용에 대해 문의사항이 있으시면{" "}
              <Link href="mailto:sales@biocompare.kr" style={link}>
                sales@biocompare.kr
              </Link>
              로 연락주세요.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              본 메일은 BioCompare 견적 완료에 대한 자동 발송 메일입니다.
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} BioCompare. All rights reserved.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://biocompare.kr" style={footerLink}>
                홈페이지
              </Link>
              {" | "}
              <Link href="https://biocompare.kr/privacy" style={footerLink}>
                개인정보처리방침
              </Link>
              {" | "}
              <Link href="https://biocompare.kr/terms" style={footerLink}>
                이용약관
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px",
};

const header = {
  backgroundColor: "#1e40af",
  padding: "24px 40px",
};

const logo = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0",
};

const content = {
  padding: "40px",
};

const iconContainer = {
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const successIcon = {
  backgroundColor: "#10b981",
  borderRadius: "50%",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "32px",
  fontWeight: "bold" as const,
  height: "64px",
  lineHeight: "64px",
  margin: "0",
  textAlign: "center" as const,
  width: "64px",
};

const h1 = {
  color: "#1e293b",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const greeting = {
  color: "#334155",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const paragraph = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "0 0 24px",
};

const infoBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "20px",
  margin: "0 0 24px",
};

const infoLabel = {
  color: "#64748b",
  fontSize: "14px",
  width: "120px",
};

const infoValue = {
  color: "#1e293b",
  fontSize: "14px",
  fontWeight: "600" as const,
  textAlign: "right" as const,
};

const totalAmountValue = {
  color: "#1e40af",
  fontSize: "16px",
  fontWeight: "bold" as const,
  textAlign: "right" as const,
};

const divider = {
  borderColor: "#e2e8f0",
  margin: "12px 0",
};

const timeline = {
  backgroundColor: "#ecfdf5",
  border: "1px solid #a7f3d0",
  borderRadius: "8px",
  padding: "20px",
  margin: "0 0 24px",
};

const timelineTitle = {
  color: "#047857",
  fontSize: "14px",
  fontWeight: "600" as const,
  margin: "0 0 16px",
  textAlign: "center" as const,
};

const stepCompleted = {
  textAlign: "center" as const,
  width: "80px",
};

const stepActive = {
  textAlign: "center" as const,
  width: "80px",
};

const stepNumberCompleted = {
  backgroundColor: "#10b981",
  borderRadius: "50%",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "12px",
  fontWeight: "bold" as const,
  height: "24px",
  lineHeight: "24px",
  margin: "0 0 4px",
  textAlign: "center" as const,
  width: "24px",
};

const stepNumberActive = {
  backgroundColor: "#047857",
  borderRadius: "50%",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "12px",
  fontWeight: "bold" as const,
  height: "24px",
  lineHeight: "24px",
  margin: "0 0 4px",
  textAlign: "center" as const,
  width: "24px",
};

const stepText = {
  color: "#6b7280",
  fontSize: "12px",
  margin: "0",
};

const stepTextActive = {
  color: "#047857",
  fontSize: "12px",
  fontWeight: "600" as const,
  margin: "0",
};

const stepLineCompleted = {
  backgroundColor: "#10b981",
  height: "2px",
  margin: "12px 0",
  width: "40px",
};

const highlightBox = {
  backgroundColor: "#fef3c7",
  border: "1px solid #fcd34d",
  borderRadius: "8px",
  color: "#92400e",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "0 0 24px",
  padding: "12px 16px",
  textAlign: "center" as const,
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#10b981",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  textDecoration: "none",
};

const helpText = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "20px",
  textAlign: "center" as const,
};

const link = {
  color: "#1e40af",
  textDecoration: "underline",
};

const footer = {
  backgroundColor: "#f8fafc",
  borderTop: "1px solid #e2e8f0",
  padding: "24px 40px",
  textAlign: "center" as const,
};

const footerText = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "20px",
  margin: "0 0 8px",
};

const footerLinks = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "20px",
  margin: "16px 0 0",
};

const footerLink = {
  color: "#64748b",
  textDecoration: "none",
};

export default QuoteCompletedEmail;
