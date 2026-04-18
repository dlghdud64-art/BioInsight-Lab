/**
 * Node.js 서버 환경용 DOM API 폴리필
 *
 * pdfjs-dist (pdf-parse v2 종속)가 DOMMatrix, DOMPoint, Path2D 등
 * 브라우저 전용 API를 내부적으로 참조합니다.
 * 서버에서 텍스트 추출만 수행하므로 정확한 기하 연산이 핵심은 아니지만,
 * 2D 행렬 연산은 올바르게 구현하여 텍스트 좌표 계산에 문제가 없도록 합니다.
 *
 * 사용법: route handler 최상단에서 import "@/lib/server-polyfills";
 */

/* ── DOMMatrix 폴리필 ── */

if (typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrixPolyfill {
    a: number; b: number; c: number; d: number; e: number; f: number;
    m11: number; m12: number; m13: number; m14: number;
    m21: number; m22: number; m23: number; m24: number;
    m31: number; m32: number; m33: number; m34: number;
    m41: number; m42: number; m43: number; m44: number;
    is2D: boolean;
    isIdentity: boolean;

    constructor(init?: string | number[] | Float32Array | Float64Array) {
      // 기본값: 단위 행렬
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
      this.is2D = true;
      this.isIdentity = true;

      if (init) {
        const arr = typeof init === "string" ? parseMatrixString(init) : Array.from(init);
        if (arr.length === 6) {
          this._set2D(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5]);
        } else if (arr.length === 16) {
          this._set3D(arr);
        }
      }
    }

    private _set2D(a: number, b: number, c: number, d: number, e: number, f: number) {
      this.a = this.m11 = a;
      this.b = this.m12 = b;
      this.c = this.m21 = c;
      this.d = this.m22 = d;
      this.e = this.m41 = e;
      this.f = this.m42 = f;
      this.is2D = true;
      this.isIdentity = a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0;
    }

    private _set3D(v: number[]) {
      [
        this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44,
      ] = v;
      this.a = this.m11; this.b = this.m12;
      this.c = this.m21; this.d = this.m22;
      this.e = this.m41; this.f = this.m42;
      this.is2D = false;
      this.isIdentity = false;
    }

    static fromMatrix(other: any): DOMMatrixPolyfill {
      if (!other) return new DOMMatrixPolyfill();
      return new DOMMatrixPolyfill([
        other.a ?? other.m11 ?? 1,
        other.b ?? other.m12 ?? 0,
        other.c ?? other.m21 ?? 0,
        other.d ?? other.m22 ?? 1,
        other.e ?? other.m41 ?? 0,
        other.f ?? other.m42 ?? 0,
      ]);
    }

    static fromFloat32Array(arr: Float32Array): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill(Array.from(arr));
    }

    static fromFloat64Array(arr: Float64Array): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill(Array.from(arr));
    }

    multiply(other: any): DOMMatrixPolyfill {
      const oa = other?.a ?? 1, ob = other?.b ?? 0, oc = other?.c ?? 0,
            od = other?.d ?? 1, oe = other?.e ?? 0, of_ = other?.f ?? 0;
      return new DOMMatrixPolyfill([
        this.a * oa + this.c * ob,
        this.b * oa + this.d * ob,
        this.a * oc + this.c * od,
        this.b * oc + this.d * od,
        this.a * oe + this.c * of_ + this.e,
        this.b * oe + this.d * of_ + this.f,
      ]);
    }

    multiplySelf(other: any): DOMMatrixPolyfill {
      const result = this.multiply(other);
      this._set2D(result.a, result.b, result.c, result.d, result.e, result.f);
      return this;
    }

    preMultiplySelf(other: any): DOMMatrixPolyfill {
      const om = DOMMatrixPolyfill.fromMatrix(other);
      const result = om.multiply(this);
      this._set2D(result.a, result.b, result.c, result.d, result.e, result.f);
      return this;
    }

    inverse(): DOMMatrixPolyfill {
      const det = this.a * this.d - this.b * this.c;
      if (Math.abs(det) < 1e-12) return new DOMMatrixPolyfill([0, 0, 0, 0, 0, 0]);
      const invDet = 1 / det;
      return new DOMMatrixPolyfill([
        this.d * invDet,
        -this.b * invDet,
        -this.c * invDet,
        this.a * invDet,
        (this.c * this.f - this.d * this.e) * invDet,
        (this.b * this.e - this.a * this.f) * invDet,
      ]);
    }

    invertSelf(): DOMMatrixPolyfill {
      const inv = this.inverse();
      this._set2D(inv.a, inv.b, inv.c, inv.d, inv.e, inv.f);
      return this;
    }

    translate(tx = 0, ty = 0, _tz = 0): DOMMatrixPolyfill {
      return this.multiply(new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty]));
    }

    translateSelf(tx = 0, ty = 0, _tz = 0): DOMMatrixPolyfill {
      const result = this.translate(tx, ty);
      this._set2D(result.a, result.b, result.c, result.d, result.e, result.f);
      return this;
    }

    scale(sx = 1, sy?: number, _sz = 1, _ox = 0, _oy = 0, _oz = 0): DOMMatrixPolyfill {
      const actualSy = sy ?? sx;
      return this.multiply(new DOMMatrixPolyfill([sx, 0, 0, actualSy, 0, 0]));
    }

    scaleSelf(sx = 1, sy?: number): DOMMatrixPolyfill {
      const result = this.scale(sx, sy);
      this._set2D(result.a, result.b, result.c, result.d, result.e, result.f);
      return this;
    }

    rotate(angle = 0): DOMMatrixPolyfill {
      const rad = angle * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return this.multiply(new DOMMatrixPolyfill([cos, sin, -sin, cos, 0, 0]));
    }

    rotateSelf(angle = 0): DOMMatrixPolyfill {
      const result = this.rotate(angle);
      this._set2D(result.a, result.b, result.c, result.d, result.e, result.f);
      return this;
    }

    flipX(): DOMMatrixPolyfill {
      return this.multiply(new DOMMatrixPolyfill([-1, 0, 0, 1, 0, 0]));
    }

    flipY(): DOMMatrixPolyfill {
      return this.multiply(new DOMMatrixPolyfill([1, 0, 0, -1, 0, 0]));
    }

    transformPoint(pt?: { x?: number; y?: number; z?: number; w?: number }): DOMPointPolyfill {
      const x = pt?.x ?? 0;
      const y = pt?.y ?? 0;
      return new DOMPointPolyfill(
        this.a * x + this.c * y + this.e,
        this.b * x + this.d * y + this.f,
        0,
        1,
      );
    }

    toFloat32Array(): Float32Array {
      return new Float32Array([
        this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44,
      ]);
    }

    toFloat64Array(): Float64Array {
      return new Float64Array([
        this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44,
      ]);
    }

    toJSON(): any {
      return { a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f };
    }

    toString(): string {
      return this.is2D
        ? `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`
        : `matrix3d(${this.m11}, ${this.m12}, ${this.m13}, ${this.m14}, ${this.m21}, ${this.m22}, ${this.m23}, ${this.m24}, ${this.m31}, ${this.m32}, ${this.m33}, ${this.m34}, ${this.m41}, ${this.m42}, ${this.m43}, ${this.m44})`;
    }
  }

  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
  (globalThis as any).DOMMatrixReadOnly = DOMMatrixPolyfill;
}

/* ── DOMPoint 폴리필 ── */

class DOMPointPolyfill {
  x: number; y: number; z: number; w: number;
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x; this.y = y; this.z = z; this.w = w;
  }
  static fromPoint(other: any): DOMPointPolyfill {
    return new DOMPointPolyfill(other?.x ?? 0, other?.y ?? 0, other?.z ?? 0, other?.w ?? 1);
  }
  toJSON(): any {
    return { x: this.x, y: this.y, z: this.z, w: this.w };
  }
}

if (typeof globalThis.DOMPoint === "undefined") {
  (globalThis as any).DOMPoint = DOMPointPolyfill;
  (globalThis as any).DOMPointReadOnly = DOMPointPolyfill;
}

/* ── Path2D 폴리필 (최소 구현) ── */

if (typeof globalThis.Path2D === "undefined") {
  (globalThis as any).Path2D = class Path2DPolyfill {
    private _ops: string[] = [];
    constructor(_path?: string) {
      if (_path) this._ops.push(_path);
    }
    moveTo(_x: number, _y: number) {}
    lineTo(_x: number, _y: number) {}
    bezierCurveTo(_cp1x: number, _cp1y: number, _cp2x: number, _cp2y: number, _x: number, _y: number) {}
    quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number) {}
    arc(_x: number, _y: number, _r: number, _sa: number, _ea: number, _ccw?: boolean) {}
    rect(_x: number, _y: number, _w: number, _h: number) {}
    closePath() {}
  };
}

/* ── ImageData 폴리필 (최소 구현) ── */

if (typeof globalThis.ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageDataPolyfill {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height ?? (dataOrWidth.length / (widthOrHeight * 4));
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}

/* ── 유틸 ── */

function parseMatrixString(s: string): number[] {
  const m3d = s.match(/matrix3d\((.+)\)/);
  if (m3d) return m3d[1].split(",").map(Number);
  const m2d = s.match(/matrix\((.+)\)/);
  if (m2d) return m2d[1].split(",").map(Number);
  return [];
}

export {};
