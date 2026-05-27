/**
 * Payload Encryption Adapter
 *
 * Security Batch 5: Adapter boundary 정의
 * Security Batch 7: AES-256-GCM 실제 구현 + env 기반 auto-init
 *
 * browser-safe 데이터라도 sessionStorage에 저장 시 암호화하기 위한
 * adapter boundary.
 *
 * 설계 원칙:
 * - fake encryption / security theater 금지
 * - LABAXIS_ENCRYPTION_KEY 환경변수 존재 시 → AES-256-GCM 실제 암호화
 * - 환경변수 미설정 시 → PlaintextFallbackAdapter (개발/빌드)
 * - HKDF 기반 per-purpose key 파생 (audit, session, payload 용도 분리)
 * - Web Crypto API 사용 (AES-GCM 256bit + HKDF-SHA256)
 * - KMS 교체 가능한 key provider boundary
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
// Key Provider Interface (Batch 7: KMS-ready boundary)
// ═══════════════════════════════════════════════════════

/** Key purpose — HKDF info에 사용, 용도별 파생 키 분리 */
export type KeyPurpose = 'payload' | 'audit' | 'session' | 'token';

/**
 * Key Provider Interface
 *
 * 현재: 환경변수 기반 (EnvKeyProvider)
 * 추후: KMS 기반 (AwsKmsKeyProvider, GcpKmsKeyProvider 등)
 */
export interface EncryptionKeyProvider {
  /** Master key 가져오기 (raw bytes) */
  getMasterKey(): Promise<ArrayBuffer | null>;
  /** Provider 타입 */
  getProviderType(): string;
  /** 키 사용 가능 여부 */
  isAvailable(): boolean;
}

/**
 * 환경변수 기반 Key Provider
 *
 * LABAXIS_ENCRYPTION_KEY: hex-encoded 256-bit (64자) 키
 * 예: openssl rand -hex 32
 */
export class EnvKeyProvider implements EncryptionKeyProvider {
  private cachedKey: ArrayBuffer | null = null;
  private checked = false;

  getMasterKey(): Promise<ArrayBuffer | null> {
    if (this.checked) return Promise.resolve(this.cachedKey);
    this.checked = true;

    const hexKey = typeof process !== 'undefined'
      ? process.env?.LABAXIS_ENCRYPTION_KEY
      : undefined;

    if (!hexKey || hexKey.length !== 64) {
      this.cachedKey = null;
      return Promise.resolve(null);
    }

    // hex → ArrayBuffer
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hexKey.substring(i * 2, i * 2 + 2), 16);
    }
    this.cachedKey = bytes.buffer;
    return Promise.resolve(this.cachedKey);
  }

  getProviderType(): string {
    return 'env';
  }

  isAvailable(): boolean {
    const hexKey = typeof process !== 'undefined'
      ? process.env?.LABAXIS_ENCRYPTION_KEY
      : undefined;
    return !!hexKey && hexKey.length === 64;
  }
}

// ═══════════════════════════════════════════════════════
// HKDF Key Derivation (Batch 7)
// ═══════════════════════════════════════════════════════

/**
 * HKDF-SHA256 기반 purpose-specific key 파생
 *
 * Master key에서 용도별 파생 키를 생성하여,
 * 하나의 master key로 여러 용도의 독립적인 암호화 키를 사용.
 *
 * @param masterKey - 원본 master key (256-bit)
 * @param purpose - 키 용도 (info parameter)
 * @param salt - optional salt (기본: 'labaxis-v1')
 */
export async function deriveKey(
  masterKey: ArrayBuffer,
  purpose: KeyPurpose,
  salt?: string,
): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto API가 사용할 수 없습니다');

  const encoder = new TextEncoder();
  const saltBytes = encoder.encode(salt || 'labaxis-v1');
  const info = encoder.encode(`labaxis:${purpose}:aes-256-gcm`);

  // Master key → HKDF base key
  const baseKey = await subtle.importKey(
    'raw', masterKey, 'HKDF', false, ['deriveKey'],
  );

  // HKDF → AES-GCM 256-bit key
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ═══════════════════════════════════════════════════════
// AES-256-GCM Encryption Adapter (Batch 7: 실제 구현)
// ═══════════════════════════════════════════════════════

/**
 * AES-256-GCM Encryption Adapter
 *
 * Web Crypto API 기반 실제 암호화:
 * 1. Key Provider에서 master key 가져오기 (env 또는 KMS)
 * 2. HKDF로 purpose-specific key 파생
 * 3. AES-256-GCM 암호화 (12-byte random IV)
 * 4. ciphertext + IV + key purpose 저장
 *
 * backward compat: setEncryptionKey()로 직접 주입도 지원
 */
export class AesGcmEncryptionAdapter implements PayloadEncryptionAdapter {
  private readonly fallback = new PlaintextFallbackAdapter();
  private readonly keyProvider: EncryptionKeyProvider;
  private readonly purpose: KeyPurpose;
  private derivedKey: CryptoKey | null = null;
  private manualKey: CryptoKey | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    keyProvider?: EncryptionKeyProvider,
    purpose?: KeyPurpose,
  ) {
    this.keyProvider = keyProvider || new EnvKeyProvider();
    this.purpose = purpose || 'payload';
  }

  /** 수동 키 주입 (backward compat / 테스트용) */
  async setEncryptionKey(rawKey: ArrayBuffer): Promise<void> {
    if (typeof globalThis.crypto?.subtle?.importKey !== 'function') return;
    this.manualKey = await globalThis.crypto.subtle.importKey(
      'raw', rawKey,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt'],
    );
  }

  /** HKDF 파생 키 초기화 (lazy, 1회) */
  private async ensureKey(): Promise<CryptoKey | null> {
    if (this.manualKey) return this.manualKey;
    if (this.derivedKey) return this.derivedKey;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const masterKey = await this.keyProvider.getMasterKey();
          if (!masterKey) return;
          this.derivedKey = await deriveKey(masterKey, this.purpose);
        } catch {
          // Crypto 미지원 환경 — fallback
          this.derivedKey = null;
        }
      })();
    }
    await this.initPromise;
    return this.derivedKey;
  }

  async encrypt(plaintext: string): Promise<EncryptedPayload> {
    const key = await this.ensureKey();
    if (!key) return this.fallback.encrypt(plaintext);

    const encoder = new TextEncoder();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const data = encoder.encode(plaintext);

    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
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

    const key = await this.ensureKey();
    if (!key || !encrypted.iv) {
      throw new Error('복호화 키를 초기화할 수 없거나 IV가 누락되었습니다');
    }

    const cipherBytes = new Uint8Array(
      (encrypted.ciphertext.match(/.{2}/g) || []).map(h => parseInt(h, 16)),
    );
    const ivBytes = new Uint8Array(
      (encrypted.iv.match(/.{2}/g) || []).map(h => parseInt(h, 16)),
    );

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      cipherBytes,
    );

    return new TextDecoder().decode(decrypted);
  }

  getAlgorithm(): string {
    return (this.derivedKey || this.manualKey) ? 'aes-256-gcm' : 'plaintext_fallback';
  }

  isEncryptionAvailable(): boolean {
    return (this.derivedKey || this.manualKey) !== null;
  }
}

/** Backward compat alias — 기존 import 호환 유지 */
export const AesGcmAdapterStub = AesGcmEncryptionAdapter;

// ═══════════════════════════════════════════════════════
// Singleton Factory (auto-detect, Batch 7)
// ═══════════════════════════════════════════════════════

let currentEncryptionAdapter: PayloadEncryptionAdapter | null = null;

/**
 * Web Crypto API + 환경변수 기반 AesGcmEncryptionAdapter 생성 시도
 * 실패 시 null 반환 → PlaintextFallbackAdapter fallback
 */
function tryCreateAesGcmAdapter(): PayloadEncryptionAdapter | null {
  // Web Crypto API 사용 가능 확인
  if (typeof globalThis.crypto?.subtle?.encrypt !== 'function') return null;

  // 환경변수 키 존재 확인
  const keyProvider = new EnvKeyProvider();
  if (!keyProvider.isAvailable()) return null;

  return new AesGcmEncryptionAdapter(keyProvider, 'payload');
}

/**
 * Encryption adapter 가져오기
 *
 * 우선순위:
 * 1. 명시적으로 set된 adapter (DI)
 * 2. LABAXIS_ENCRYPTION_KEY + Web Crypto → AesGcmEncryptionAdapter
 * 3. Fallback → PlaintextFallbackAdapter
 */
export function getEncryptionAdapter(): PayloadEncryptionAdapter {
  if (!currentEncryptionAdapter) {
    const aesAdapter = tryCreateAesGcmAdapter();
    currentEncryptionAdapter = aesAdapter || new PlaintextFallbackAdapter();
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

/**
 * 현재 adapter 타입 조회 (observability용)
 */
export async function getEncryptionAdapterType(): Promise<string> {
  const adapter = getEncryptionAdapter();
  return adapter.getAlgorithm();
}

/**
 * Purpose-specific adapter 생성 (audit, session 등 용도별)
 * 같은 master key에서 HKDF로 다른 파생 키 사용
 */
export function createPurposeAdapter(purpose: KeyPurpose): PayloadEncryptionAdapter {
  const keyProvider = new EnvKeyProvider();
  if (!keyProvider.isAvailable() || typeof globalThis.crypto?.subtle?.encrypt !== 'function') {
    return new PlaintextFallbackAdapter();
  }
  return new AesGcmEncryptionAdapter(keyProvider, purpose);
}
