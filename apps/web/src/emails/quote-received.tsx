import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from "@react-email/components";

interface QuoteReceivedEmailProps {
  customerName: string;
  quoteNumber: string;
  requestDate: string;
  itemCount: number;
  totalAmount?: string;
  dashboardUrl?: string;
}

export function QuoteReceivedEmail({
  customerName = "고객",
  quoteNumber = "0000",
  requestDate = new Date().toLocaleDateString("ko-KR"),
  itemCount = 0,
  totalAmount,
  dashboardUrl = "https://biocompare.kr/dashboard",
}: QuoteReceivedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>견적 요청이 정상적으로 접수되었습니다 - BioCompare</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>BioCompare</Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>견적 요청 접수 완료</Heading>

            <Text style={greeting}>
              {customerName} 님, 안녕하세요.
            </Text>

            <Text style={paragraph}>
              요청하신 견적이 <strong>정상적으로 접수</strong>되었습니다.
              담당자가 확인 후 빠른 시일 내에 답변드리겠습니다.
            </Text>

            {/* Quote Info Box */}
            <Section style={infoBox}>
              <Row>
                <Column style={infoLabel}>요청 번호</Column>
                <Column style={infoValue}>#{quoteNumber}</Column>
              </Row>
              <Hr style={divider} />
              <Row>
                <Column style={infoLabel}>요청 일시</Column>
                <Column style={infoValue}>{requestDate}</Column>
              </Row>
              <Hr style={divider} />
              <Row>
                <Column style={infoLabel}>요청 품목</Column>
                <Column style={infoValue}>{itemCount}개 품목</Column>
              </Row>
              {totalAmount && (
                <>
                  <Hr style={divider} />
                  <Row>
                    <Column style={infoLabel}>예상 금액</Column>
                    <Column style={infoValue}>{totalAmount}</Column>
                  </Row>
                </>
              )}
            </Section>

            {/* Status Timeline */}
            <Section style={timeline}>
              <Text style={timelineTitle}>진행 상태</Text>
              <Row>
                <Column style={stepActive}>
                  <Text style={stepNumber}>1</Text>
                  <Text style={stepText}>접수 완료</Text>
                </Column>
                <Column style={stepLine}></Column>
                <Column style={stepPending}>
                  <Text style={stepNumber}>2</Text>
                  <Text style={stepText}>검토 중</Text>
                </Column>
                <Column style={stepLine}></Column>
                <Column style={stepPending}>
                  <Text style={stepNumber}>3</Text>
                  <Text style={stepText}>견적 발송</Text>
                </Column>
              </Row>
            </Section>

            <Text style={paragraph}>
              견적 진행 상황은 대시보드에서 실시간으로 확인하실 수 있습니다.
            </Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Link href={dashboardUrl} style={button}>
                대시보드에서 확인하기
              </Link>
            </Section>

            <Text style={helpText}>
              문의사항이 있으시면 언제든지{" "}
              <Link href="mailto:support@biocompare.kr" style={link}>
                support@biocompare.kr
              </Link>
              로 연락주세요.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              본 메일은 BioCompare 견적 요청에 대한 자동 발송 메일입니다.
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

const divider = {
  borderColor: "#e2e8f0",
  margin: "12px 0",
};

const timeline = {
  backgroundColor: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "8px",
  padding: "20px",
  margin: "0 0 24px",
};

const timelineTitle = {
  color: "#1e40af",
  fontSize: "14px",
  fontWeight: "600" as const,
  margin: "0 0 16px",
  textAlign: "center" as const,
};

const stepActive = {
  textAlign: "center" as const,
  width: "80px",
};

const stepPending = {
  textAlign: "center" as const,
  width: "80px",
  opacity: "0.5",
};

const stepNumber = {
  backgroundColor: "#1e40af",
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
  color: "#1e293b",
  fontSize: "12px",
  margin: "0",
};

const stepLine = {
  backgroundColor: "#cbd5e1",
  height: "2px",
  margin: "12px 0",
  width: "40px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#1e40af",
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

export default QuoteReceivedEmail;
