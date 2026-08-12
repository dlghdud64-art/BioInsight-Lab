/**
 * @google/genai 모듈 타입 선언
 *
 * 패키지 미설치 환경에서도 빌드가 가능하도록 최소 타입을 선언합니다.
 * 실제 런타임에서는 dynamic import + try-catch로 안전하게 처리됩니다.
 */
declare module "@google/genai" {
  export class GoogleGenAI {
    constructor(options: { apiKey: string });
    models: {
      generateContent(params: {
        model: string;
        contents: Array<{
          role: string;
          parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
        }>;
        config?: {
          temperature?: number;
          maxOutputTokens?: number;
        };
      }): Promise<{ text: string | null }>;
    };
  }
}
