/**
 * PDF 버퍼에서 텍스트 추출
 * Next.js 서버 사이드에서만 동작 (Edge Runtime에서는 동작하지 않음)
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // pdf-parse는 CommonJS 모듈이므로 서버 사이드에서 require 사용
    // Next.js는 서버 사이드에서 require를 지원함
    let pdfParse: any;
    
    // 서버 사이드에서만 동작하도록 확인
    if (typeof window !== 'undefined') {
      throw new Error("PDF 파싱은 서버 사이드에서만 가능합니다.");
    }
    
    try {
      // CommonJS require 방식
      // Next.js의 serverComponentsExternalPackages 설정으로 인해
      // pdf-parse가 외부 패키지로 처리되어 require가 정상 작동해야 함
      // @ts-ignore - require는 Node.js 런타임에서 사용 가능
      const pdfParseModule = require("pdf-parse");
      
      // pdf-parse는 일반적으로 함수로 export되지만,
      // Next.js 번들링 후 객체로 변환될 수 있음
      // 다양한 형태를 시도
      
      if (typeof pdfParseModule === 'function') {
        // 직접 함수인 경우
        pdfParse = pdfParseModule;
      } else if (typeof pdfParseModule.default === 'function') {
        // default export인 경우
        pdfParse = pdfParseModule.default;
      } else if (pdfParseModule && typeof pdfParseModule === 'object') {
        // 객체인 경우 - pdf-parse는 실제로 함수를 포함하는 객체일 수 있음
        // 하지만 일반적으로는 모듈 자체가 함수여야 함
        
        // Next.js에서 번들링된 경우, 모듈이 객체로 변환될 수 있음
        // 이 경우 원본 함수를 찾아야 함
        
        // 시도 1: __esModule 체크
        if ((pdfParseModule as any).__esModule && pdfParseModule.default) {
          pdfParse = pdfParseModule.default;
        }
        // 시도 2: 모듈의 모든 속성 중 함수 찾기
        else {
          const keys = Object.keys(pdfParseModule);
          for (const key of keys) {
            if (typeof (pdfParseModule as any)[key] === 'function' && key !== 'default') {
              // PDFParse 같은 클래스는 제외하고, 실제 파싱 함수만 찾기
              // pdf-parse의 메인 함수는 보통 짧은 이름이거나 없음
              // 하지만 일반적으로는 모듈 자체가 함수여야 함
              continue;
            }
          }
          
          // pdf-parse는 실제로 모듈 객체로 반환되지만,
          // Next.js의 serverComponentsExternalPackages 설정으로 인해
          // 원본 모듈이 유지되어야 함
          // 일반적으로 pdf-parse는 함수로 export되지만,
          // 번들링 후에는 객체로 변환될 수 있음
          
          // 실제로 pdf-parse는 함수이지만 객체로 감싸져 있을 수 있음
          // 모듈의 실제 함수를 찾기 위해 모든 속성 확인
          const possibleFunctions = Object.keys(pdfParseModule).filter(
            key => typeof (pdfParseModule as any)[key] === 'function' && 
                   key !== 'default' && 
                   !key.startsWith('_')
          );
          
          if (possibleFunctions.length > 0) {
            // 첫 번째 함수 사용 (일반적으로 메인 함수)
            pdfParse = (pdfParseModule as any)[possibleFunctions[0]];
          } else {
            // 마지막 시도: 모듈 자체를 함수로 사용
            // pdf-parse는 실제로 호출 가능한 객체일 수 있음
            // 하지만 일반적으로는 함수여야 함
            console.error("pdf-parse module structure:", {
              type: typeof pdfParseModule,
              keys: Object.keys(pdfParseModule),
              hasDefault: !!pdfParseModule.default,
              isFunction: typeof pdfParseModule === 'function',
              possibleFunctions,
            });
            throw new Error(`pdf-parse 모듈 구조를 인식할 수 없습니다. Next.js 설정(serverComponentsExternalPackages)을 확인하고 개발 서버를 재시작하세요.`);
          }
        }
      } else {
        throw new Error(`pdf-parse 모듈을 올바르게 로드할 수 없습니다. 타입: ${typeof pdfParseModule}`);
      }
    } catch (requireError: any) {
      console.error("pdf-parse require error:", requireError);
      throw new Error(`pdf-parse 모듈 로드 실패: ${requireError.message}. next.config.cjs의 serverComponentsExternalPackages 설정을 확인하세요.`);
    }
    
    // 최종 확인: pdf-parse가 함수인지 확인
    if (typeof pdfParse !== 'function') {
      console.error("pdf-parse final type:", typeof pdfParse);
      console.error("pdf-parse value:", pdfParse);
      throw new Error(`pdf-parse를 함수로 변환할 수 없습니다. 최종 타입: ${typeof pdfParse}`);
    }
    
    // PDF 파싱 실행
    const data = await pdfParse(pdfBuffer, {
      // 표 구조 보존을 위한 옵션
      max: 0, // 모든 페이지 파싱
    });
    
    if (!data) {
      throw new Error("PDF 파싱 결과가 없습니다.");
    }
    
    if (!data.text) {
      throw new Error("PDF에서 텍스트를 추출할 수 없습니다. 빈 문서이거나 텍스트가 없을 수 있습니다.");
    }
    
    // 텍스트 전처리: 표 구조 개선
    let processedText = data.text;
    
    // 연속된 공백을 하나로 (단, 탭은 보존)
    processedText = processedText.replace(/[ \t]+/g, (match: string) => {
      // 탭이 포함된 경우 탭으로 통일
      if (match.includes('\t')) {
        return '\t';
      }
      return ' ';
    });
    
    // 표 형식 감지 및 개선 (탭이나 여러 공백으로 구분된 열)
    // 2개 이상의 연속된 공백이나 탭을 구분자로 인식
    processedText = processedText.replace(/([^\t\n])\s{2,}([^\t\n])/g, '$1\t$2');
    
    // 줄바꿈 정리 (표 구조 보존)
    processedText = processedText.replace(/\r\n/g, '\n');
    processedText = processedText.replace(/\r/g, '\n');
    
    // 연속된 줄바꿈 정리 (단, 표 구조는 보존)
    processedText = processedText.replace(/\n{4,}/g, '\n\n\n');
    
    return processedText;
  } catch (error: any) {
    console.error("Error parsing PDF:", error);
    const errorMessage = error?.message || "알 수 없는 오류";
    const errorStack = error?.stack;
    console.error("Error stack:", errorStack);
    throw new Error(`PDF 파싱에 실패했습니다: ${errorMessage}`);
  }
}



