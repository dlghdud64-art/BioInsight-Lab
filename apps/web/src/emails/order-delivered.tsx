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

interface OrderDeliveredEmailProps {
  customerName: string;
  orderNumber: string;
  deliveredDate: string;
  itemCount: number;
  items?: Array<{
    name: string;
    quantity: number;
    brand?: string;
  }>;
  inventoryUrl?: string;
}

export function OrderDeliveredEmail({
  customerName = "고객",
  orderNumber = "ORD-0000",
  deliveredDate = new Date().toLocaleDateString("ko-KR"),
  itemCount = 0,
  items = [],
  inventoryUrl = "https://biocompare.kr/inventory",
}: OrderDeliveredEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>배송이 완료되었습니다! 인벤토리에 자동 등록되었습니다 - BioCompare</Preview>
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
              <Text style={successIcon}>📦</Text>
            </Section>

            <Heading style={h1}>배송이 완료되었습니다!</Heading>

            <Text style={greeting}>
              {customerName} 님, 안녕하세요.
            </Text>

            <Text style={paragraph}>
              주문하신 제품의 <strong>배송이 완료</strong>되었습니다.
              모든 품목이 <strong>인벤토리에 자동 등록</strong>되어 바로 재고 관리를 시작하실 수 있습니다.
            </Text>

            {/* Order Info Box */}
            <Section style={infoBox}>
              <Row>
                <Column style={infoLabel}>주문 번호</Column>
                <Column style={infoValue}>{orderNumber}</Column>
              </Row>
              <Hr style={divider} />
              <Row>
                <Column style={infoLabel}>배송 완료일</Column>
                <Column style={infoValue}>{deliveredDate}</Column>
              </Row>
              <Hr style={divider} />
              <Row>
                <Column style={infoLabel}>등록 품목</Column>
                <Column style={infoValue}>{itemCount}개 품목</Column>
              </Row>
            </Section>

            {/* Inventory Items Preview */}
            {items.length > 0 && (
              <Section style={itemsSection}>
                <Text style={itemsTitle}>📋 인벤토리 등록 품목</Text>
                {items.slice(0, 5).map((item, index) => (
                  <Section key={index} style={itemRow}>
                    <Row>
                      <Column style={itemName}>
                        {item.name}
                        {item.brand && <Text style={itemBrand}>{item.brand}</Text>}
                      </Column>
                      <Column style={itemQuantity}>x{item.quantity}</Column>
                    </Row>
                  </Section>
                ))}
                {items.length > 5 && (
                  <Text style={moreItems}>...외 {items.length - 5}개 품목</Text>
                )}
              </Section>
            )}

            {/* Status Timeline - Delivered */}
            <Section style={timeline}>
              <Text style={timelineTitle}>주문 현황</Text>
              <Row>
                <Column style={stepCompleted}>
                  <Text style={stepNumberCompleted}>✓</Text>
                  <Text style={stepText}>주문 완료</Text>
                </Column>
                <Column style={stepLineCompleted}></Column>
                <Column style={stepCompleted}>
                  <Text style={stepNumberCompleted}>✓</Text>
                  <Text style={stepText}>배송 중</Text>
                </Column>
                <Column style={stepLineCompleted}></Column>
                <Column style={stepActive}>
                  <Text style={stepNumberActive}>✓</Text>
                  <Text style={stepTextActive}>배송 완료</Text>
                </Column>
              </Row>
            </Section>

            <Text style={highlightBox}>
              💡 인벤토리에서 <strong>보관 위치</strong>와 <strong>메모</strong>를 추가하여
              효율적으로 재고를 관리해 보세요!
            </Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Link href={inventoryUrl} style={button}>
                인벤토리 확인하기
              </Link>
            </Section>

            <Text style={helpText}>
              배송 관련 문의사항이 있으시면{" "}
              <Link href="mailto:support@biocompare.kr" style={link}>
                support@biocompare.kr
              </Link>
              로 연락주세요.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              본 메일은 BioCompare 배송 완료에 대한 자동 발송 메일입니다.
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
  backgroundColor: "#7c3aed",
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
  fontSize: "48px",
  margin: "0",
  textAlign: "center" as const,
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

const itemsSection = {
  backgroundColor: "#faf5ff",
  border: "1px solid #e9d5ff",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "0 0 24px",
};

const itemsTitle = {
  color: "#7c3aed",
  fontSize: "14px",
  fontWeight: "600" as const,
  margin: "0 0 12px",
};

const itemRow = {
  borderBottom: "1px solid #e9d5ff",
  padding: "8px 0",
};

const itemName = {
  color: "#1e293b",
  fontSize: "14px",
};

const itemBrand = {
  color: "#64748b",
  fontSize: "12px",
  margin: "2px 0 0",
};

const itemQuantity = {
  color: "#7c3aed",
  fontSize: "14px",
  fontWeight: "600" as const,
  textAlign: "right" as const,
  width: "60px",
};

const moreItems = {
  color: "#64748b",
  fontSize: "12px",
  margin: "8px 0 0",
  textAlign: "center" as const,
};

const timeline = {
  backgroundColor: "#faf5ff",
  border: "1px solid #e9d5ff",
  borderRadius: "8px",
  padding: "20px",
  margin: "0 0 24px",
};

const timelineTitle = {
  color: "#7c3aed",
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
  backgroundColor: "#a855f7",
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
  backgroundColor: "#7c3aed",
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
  color: "#7c3aed",
  fontSize: "12px",
  fontWeight: "600" as const,
  margin: "0",
};

const stepLineCompleted = {
  backgroundColor: "#a855f7",
  height: "2px",
  margin: "12px 0",
  width: "40px",
};

const highlightBox = {
  backgroundColor: "#f3e8ff",
  border: "1px solid #d8b4fe",
  borderRadius: "8px",
  color: "#6b21a8",
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
  backgroundColor: "#7c3aed",
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
  color: "#7c3aed",
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

export default OrderDeliveredEmail;
