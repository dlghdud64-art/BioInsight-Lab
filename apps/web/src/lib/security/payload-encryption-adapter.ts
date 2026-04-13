/**
 * Payload Encryption Adapter
 *
 * Security Batch 5: Payload Encryption at Rest (adapter boundary)
 *
 * browser-safe 데이터라도 sessionStorage에 저장 시 암호화하기 위한
 * adapter boundary. 현재는 plaintext fallback이며,
 * 추후 AES-GCM 또는 키 관리 인프라 연결 시 실제 암호화로 교체.
 *
 * 설계 원칙:
 * - fake encryption / security theater 금지
 * - adapter boundary까지만 — 실제 키 관리는 인프라 확보 후
 * - plaintext fallback이지만 interface는 encrypt/decrypt 형태
 * - Web Crypto API 사용 준비 (AES-GCM 256bit)
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** 암호화 결과 */
export interface EncryptedPayload {
  /** 암호화된 데이터 (또는 plaintext fallback) */
  readonly ciphertext: string;
  /** 사용된 알고리즘 */
  readonly algorithm: 'aes-256-gcm' | 'plaintext_fallback';
  /** IV (initialization vector) — AES-GCM 사용 시 */
  readonly iv?: string;
  /** 암호화 시점 */
  readonly encryptedAt: string;
}

/** Encryption Adapter Interface */
export interface PayloadEncryptionAdapter {
  /** 데이터 암호화 */
  encrypt(plaintext: string): Promise<EncryptedPayload>;

  /** 데이터 복호화 */
  decrypt(encrypted: EncryptedPayload): Promise<string>;

  /** 현재 알고리즘 확인 */
  getAlgorithm(): string;

  /** 암호화 가능 여부 확인 */
  isEncryptionAvailable(): boolean;
}

// ═══════════════════════════════════════════════════════
// Plaintext Fallback Adapter (현재 기본)
// ═══════════════════════════════════════════════════════

/**
 * Plaintext Fallback Adapter
 *
 * 실제 암호화 없이 base64 인코딩만 수행.
 * 키 관리 인프라 확보 전까지의 임시 adapter.
 * 보안 강도: 없음 (obfuscation only, NOT encryption)
 */
export class PlaintextFallbackAdapter implements PayloadEncryptionAdapter {
  async encrypt(plaintext: string): Promise<EncryptedPayload> {
    // Base64 인코딩 (암호화 아님, 단순 직렬화)
    const encoded = typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(plaintext)))
      : Buffer.from(plaintext, 'utf-8').toString('base64');

    return {
      ciphertext: encoded,
      algorithm: 'plaintext_fallback',
      encryptedAt: new Date().toISOString(),
    };
  }

  async decrypt(encrypted: EncryptedPayload): Promise<string> {
    if (encrypted.algorithm !== 'plaintext_fallback') {
      throw new Error('이 adapter는 plaintext_fallback만 복호화할 수 있습니다');
    }

    return typeof atob === 'function'
      ? decodeURIComponent(escape(atob(encrypted.ciphertext)))
      : Buffer.from(encrypted.ciphertext, 'base64').toString('utf-8');
  }

  getAlgorithm(): string {
    return 'plaintext_fallback';
  }

  isEncryptionAvailable(): boolean {
    return false; // 실제 암호화 미사용
  }
}

// ═══════════════════════════════════════════════════════
// AES-GCM Adapter Stub (Web Crypto API 기반)
// ═══════════════════════════════════════════════════════

/**
 * AES-256-GCM Adapter — boundary stub
 *
 * Web Crypto API가 사용 가능하고 키가 주입된 경우 실제 암호화 수행.
 * 현재는 키 관리 인프라가 없으므로 PlaintextFallbackAdapter로 fallback.
 *
 * 실제 production 구현 시:
 * 1. 환경변수 또는 KMS에서 master key 가져오기
 * 2. master key로 per-session data key 파생 (HKDF)
 * 3. data key로 AES-256-GCM 암호화
 * 4. encrypted data + IV + key ID를 저장
 */
export class AesGcmAdapterStub implements PayloadEncryptionAdapter {
  private readonly fallback = new PlaintextFallbackAdapter();
  private cryptoKey: CryptoKey | null = null;

  /**
   * 키 주입 (production에서는 KMS에서 가져옴)
   */
  async setEncryptionKey(rawKey: ArrayBuffer): Promise<void> {
    if (typeof globalThis.crypto?.subtle?.importKey !== 'function') return;

    this.cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  async encrypt(plaintext: string): Promise<EncryptedPayload> {
    if (!this.cryptoKey) return this.fallback.encrypt(plaintext);

    const encoder = new TextEncoder();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const data = encoder.encode(plaintext);

    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.cryptoKey,
      data,
    );

    return {
      ciphertext: Array.from(new Uint8Array(encrypted))
        .map(b => b.toString(16).padStart(2, '0')).join(''),
      algorithm: 'aes-256-gcm',
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
      encryptedAt: new Date().toISOString(),
    };
  }

  async decrypt(encrypted: EncryptedPayload): Promise<string> {
    if (encrypted.algorithm === 'plaintext_fallback') {
      return this.fallback.decrypt(encrypted);
    }

    if (!this.cryptoKey || !encrypted.iv) {
      throw new Error('복호화 키가 설정되지 않았거나 IV가 누락되었습니다');
    }

    const cipherBytes = new Uint8Array(
      (encrypted.ciphertext.match(/.{2}/g) || []).map(h => parseInt(h, 16)),
    );
    const ivBytes = new Uint8Array(
      (encrypted.iv.match(/.{2}/g) || []).map(h => parseInt(h, 16)),
    );

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      this.cryptoKey,
      cipherBytes,
    );

    return new TextDecoder().decode(decrypted);
  }

  getAlgorithm(): string {
    return this.cryptoKey ? 'aes-256-gcm' : 'plaintext_fallback';
  }

  isEncryptionAvailable(): boolean {
    return this.cryptoKey !== null;
  }
}

// ═══════════════════════════════════════════════════════
// Singleton Factory
// ═══════════════════════════════════════════════════════

let currentEncryptionAdapter: PayloadEncryptionAdapter | null = null;

/**
 * Encryption adapter 가져오기
 *
 * 기본: PlaintextFallbackAdapter
 * KMS 연결 후: AesGcmAdapter로 교체
 */
export function getEncryptionAdapter(): PayloadEncryptionAdapter {
  if (!currentEncryptionAdapter) {
    currentEncryptionAdapter = new PlaintextFallbackAdapter();
  }
  return currentEncryptionAdapter;
}

/**
 * Adapter 교체 (DI)
 */
export function setEncryptionAdapter(adapter: PayloadEncryptionAdapter): void {
  currentEncryptionAdapter = adapter;
}

/** 테스트용 초기화 */
export function __resetEncryptionAdapter(): void {
  currentEncryptionAdapter = null;
}
