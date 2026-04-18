'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Activity, Shield, Database, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

function SplineViewer({ scene }: { scene: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    let app: any = null;

    (async () => {
      try {
        const { Application } = await import('@splinetool/runtime');
        app = new Application(canvasRef.current!);
        await app.load(scene);
        setLoading(false);
      } catch (e) {
        console.warn('[SplineViewer] Failed to load:', e);
        setLoading(false);
      }
    })();

    return () => { app?.dispose?.(); };
  }, [scene]);

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0B1120] z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-mono tracking-wider">LOADING PIPELINE ENGINE...</p>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full" />
    </>
  );
}

export default function ArchitectureShowcase() {
  return (
    <div className="relative w-full h-screen bg-[#0B1120] text-white overflow-hidden font-sans">

      {/* [1] 3D PIPELINE CORE ENGINE */}
      <div className="absolute inset-0 z-0">
        <SplineViewer scene="https://prod.spline.design/Nd9Ab5oDbi1kcWsV/scene.splinecode?v=2" />
      </div>

      {/* [2] FLOATING HUD */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-10">

        {/* Top Header */}
        <header className="flex justify-between items-start">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="pointer-events-auto flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-fit bg-[#0B1120]/60 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-sm"
            >
              <ChevronLeft size={16} />
              메인으로
            </Link>
            <div className="pointer-events-auto flex items-center gap-3 bg-[#0B1120]/70 border border-white/10 px-6 py-4 rounded-2xl backdrop-blur-xl shadow-2xl">
              <div className="w-4 h-4 bg-blue-500 rounded-sm shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse" />
              <div>
                <h1 className="text-2xl font-bold tracking-widest text-white drop-shadow-md">
                  LabAxis<span className="text-blue-500 font-light">.OS</span>
                </h1>
                <p className="text-xs text-blue-400/80 font-mono mt-1 tracking-wider">PIPELINE ARCHITECTURE</p>
              </div>
            </div>
          </div>

          {/* System Status (Desktop) */}
          <div className="hidden md:flex gap-3 pointer-events-auto">
            <div className="bg-[#0B1120]/70 border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-2 backdrop-blur-xl shadow-lg transition-transform hover:-translate-y-0.5 cursor-default">
              <Activity size={14} className="text-green-400" />
              <span className="text-xs text-gray-300 font-mono tracking-wide">SYSTEM ONLINE</span>
            </div>
            <div className="bg-[#0B1120]/70 border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-2 backdrop-blur-xl shadow-lg transition-transform hover:-translate-y-0.5 cursor-default">
              <Shield size={14} className="text-blue-400" />
              <span className="text-xs text-gray-300 font-mono tracking-wide">E2E ENCRYPTED</span>
            </div>
          </div>
        </header>

        {/* Bottom Footer */}
        <footer className="flex flex-col md:flex-row justify-between items-end gap-6">

          {/* Info Panel + Login CTA */}
          <div className="pointer-events-auto max-w-md bg-[#0B1120]/80 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2 text-blue-400 mb-4">
              <Database size={20} />
              <h2 className="text-sm font-bold tracking-widest">END-TO-END DATA FLOW</h2>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-8 font-light break-keep">
              연구실의 산발적인 검색, 구매 발주, 입고 및 재고 관리를 단일 파이프라인으로 통제하십시오.
              <br />
              <span className="text-blue-400 font-medium mt-2 block">
                화면을 드래그하여 전체 운영 구조를 탐색하십시오.
              </span>
            </p>

            <Link
              href="/auth/signin"
              className="w-full group bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-between transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]"
            >
              <span className="tracking-wide">운영 시스템 접속하기</span>
              <ArrowRight size={20} className="transform group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Interaction Hint (Desktop) */}
          <div className="hidden lg:block pb-4 pr-4 pointer-events-none">
            <div className="flex flex-col items-end gap-2 text-white/60">
              <div className="flex items-center gap-3 bg-[#0B1120]/50 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
                <span className="text-xs font-mono font-bold tracking-widest">DRAG</span>
                <span className="text-xs font-light">시점 회전</span>
              </div>
              <div className="flex items-center gap-3 bg-[#0B1120]/50 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
                <span className="text-xs font-mono font-bold tracking-widest">SCROLL</span>
                <span className="text-xs font-light">확대/축소</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
