/**
 * SSO 설정 타입
 */
export interface SSOConfig {
  provider: "saml" | "oauth" | "okta" | "azure" | "google_workspace";
  enabled: boolean;
  metadataUrl?: string;
  entityId?: string;
  certificate?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  domain?: string; // 허용할 이메일 도메인
  attributeMapping?: {
    email?: string;
    name?: string;
    role?: string;
  };
}

/**
 * SSO 설정 검증
 */
export function validateSSOConfig(config: SSOConfig): { valid: boolean; error?: string } {
  if (!config.enabled) {
    return { valid: true };
  }

  if (!config.provider) {
    return { valid: false, error: "SSO provider is required" };
  }

  if (config.provider === "saml") {
    if (!config.metadataUrl && !config.entityId) {
      return { valid: false, error: "SAML requires metadataUrl or entityId" };
    }
  }

  if (config.provider === "oauth" || config.provider === "okta" || config.provider === "azure") {
    if (!config.clientId || !config.clientSecret) {
      return { valid: false, error: "OAuth requires clientId and clientSecret" };
    }
  }

  return { valid: true };
}

/**
 * SSO 설정을 NextAuth provider 설정으로 변환
 */
export function convertSSOConfigToProvider(config: SSOConfig) {
  if (!config.enabled) {
    return null;
  }

  switch (config.provider) {
    case "saml":
      // SAML은 별도 패키지 필요 (예: @node-saml/passport-saml)
      return {
        type: "saml",
        metadataUrl: config.metadataUrl,
        entityId: config.entityId,
        certificate: config.certificate,
      };
    case "oauth":
      return {
        type: "oauth",
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUrl: config.redirectUrl,
      };
    case "okta":
      return {
        type: "oauth",
        issuer: `https://${config.domain}/oauth2/default`,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      };
    case "azure":
      return {
        type: "oauth",
        issuer: `https://login.microsoftonline.com/${config.domain}/v2.0`,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      };
    case "google_workspace":
      return {
        type: "oauth",
        issuer: `https://accounts.google.com`,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        domain: config.domain,
      };
    default:
      return null;
  }
}



