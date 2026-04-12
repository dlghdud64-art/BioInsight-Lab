/**
 * Node.js Global Type Declarations
 *
 * @types/node 패키지가 monorepo hoisting 의 symlink 깨짐으로 tsc 에서
 * 로드되지 않는 문제를 우회한다. Next.js 앱은 server component / API route
 * 에서 process.env, require 등을 자연스럽게 사용하며, 이 선언이 없으면
 * TS2580 에러가 수백 건 발생한다.
 *
 * @types/node 가 정상 설치되면 본 파일은 제거해도 된다.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
    NODE_ENV: "development" | "production" | "test";
  }

  interface Process {
    env: ProcessEnv;
    cwd(): string;
    exit(code?: number): never;
    stdout: any;
    stderr: any;
    nextTick(callback: (...args: any[]) => void, ...args: any[]): void;
    platform: string;
    version: string;
  }
}

declare var process: NodeJS.Process;
declare var require: (id: string) => any;
declare var __dirname: string;
declare var __filename: string;

declare module "*.json" {
  const value: any;
  export default value;
}

// Node.js Buffer — API route / server component 에서 사용
declare class Buffer {
  static from(data: string | ArrayBuffer | SharedArrayBuffer | readonly number[], encoding?: string): Buffer;
  static alloc(size: number, fill?: string | number, encoding?: string): Buffer;
  static isBuffer(obj: any): obj is Buffer;
  toString(encoding?: string, start?: number, end?: number): string;
  readonly length: number;
  [index: number]: number;
}

// setTimeout / setInterval — global type 보강 (Node timer override)
declare function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): ReturnType<typeof globalThis.setTimeout>;
declare function clearTimeout(id: ReturnType<typeof setTimeout> | undefined): void;
declare function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): ReturnType<typeof globalThis.setInterval>;
declare function clearInterval(id: ReturnType<typeof setInterval> | undefined): void;
