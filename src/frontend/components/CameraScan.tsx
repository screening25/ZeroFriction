'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Loader2, Check, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { autoClassifyTokens } from '@/frontend/utils/inventory';

type Target = 'code' | 'title' | 'serial';
type Fields = { code?: string; title?: string; serial?: string };

const TARGETS: { key: Target; label: string; icon: string }[] = [
  { key: 'code', label: '모델명', icon: '📦' },
  { key: 'title', label: '품목명', icon: '🏷' },
  { key: 'serial', label: '시리얼', icon: '#️⃣' },
];

/**
 * 카메라 라벨 스캔 — 카메라 켠 화면에서 바로 분석·선택.
 * 라이브 미리보기를 계속 인식하고, 패턴 알고리즘으로 모델명/시리얼/사이즈로 분류된 것"만"
 * 화면에 결과 칩으로 띄운다(잡토큰은 패턴에서 걸러져 실시간이어도 정확). 칩을 탭하면 즉시 담기고,
 * '적용'으로 폼에 반영한다. 연속 인식이 느린 기기를 위해 '지금 분석'(고해상도 1회)도 제공.
 * 카메라 권한 거부/미지원 시 사진 선택으로 대체.
 */
export default function CameraScan({
  onApply,
  compact = false,
}: {
  onApply: (fields: Fields) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [engineMsg, setEngineMsg] = useState('인식 엔진 준비 중…');
  const [engineReady, setEngineReady] = useState(false);
  const [scanning, setScanning] = useState(false);   // 분석 중(연속/수동 공통)
  const [detected, setDetected] = useState<Fields>({});
  const [assigned, setAssigned] = useState<Fields>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<any>(null);
  const loopRef = useRef(false);
  const recognizingRef = useRef(false);
  const assignedRef = useRef<Fields>({});
  const fileRef = useRef<HTMLInputElement>(null);
  assignedRef.current = assigned;

  const getWorker = async () => {
    if (!workerRef.current) {
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status && m.status !== 'recognizing text') {
            setEngineMsg(`인식 엔진 준비 중… ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      });
      await w.setParameters({ tessedit_pageseg_mode: '11' as any });
      workerRef.current = w;
      setEngineReady(true);
    }
    return workerRef.current;
  };

  // 워커 동시 호출 방지(연속 루프 vs 수동 분석)
  const safeRecognize = async (src: HTMLCanvasElement): Promise<any | null> => {
    if (recognizingRef.current) return null;
    recognizingRef.current = true;
    setScanning(true);
    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(src);
      return data;
    } catch {
      return null;
    } finally {
      recognizingRef.current = false;
      setScanning(false);
    }
  };

  const frameToCanvas = (maxW: number): HTMLCanvasElement | null => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return null;
    const scale = Math.min(1, maxW / v.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const ingest = (data: any) => {
    if (!data) return;
    const words = (data.words || [])
      .filter((w: any) => (w.confidence ?? 0) >= 45)
      .map((w: any) => (w.text || '').trim())
      .filter((t: string) => t.length >= 2);
    const auto = autoClassifyTokens(words);
    setDetected(prev => {
      const next = { ...prev };
      (['code', 'title', 'serial'] as Target[]).forEach(k => {
        if (auto[k] && !assignedRef.current[k]) next[k] = auto[k];
      });
      return next;
    });
  };

  // 연속 인식 루프(가벼운 해상도). 3개 모두 담기면 멈춘다.
  const scanLoop = async () => {
    while (loopRef.current) {
      const a = assignedRef.current;
      if (a.code && a.title && a.serial) break;
      const canvas = frameToCanvas(960);
      if (canvas) ingest(await safeRecognize(canvas));
      await new Promise(r => setTimeout(r, 750));
    }
  };

  // 수동 1회 고해상도 정밀 분석
  const analyzeNow = async () => {
    const canvas = frameToCanvas(1600);
    if (canvas) ingest(await safeRecognize(canvas));
  };

  const stopAll = () => {
    loopRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    workerRef.current?.terminate?.();
    workerRef.current = null;
    setEngineReady(false);
  };

  const startLive = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      loopRef.current = true;
      getWorker().then(() => scanLoop()).catch(() => {});
    } catch (e: any) {
      setCamError(e?.name === 'NotAllowedError' ? '카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.' : '카메라를 열 수 없습니다.');
    }
  };

  useEffect(() => {
    if (open) startLive();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 사진 파일 → 동일 분석
  const runFileOcr = async (file: File) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1600, img.naturalWidth);
      canvas.height = Math.round(img.naturalHeight * (canvas.width / img.naturalWidth));
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); ingest(await safeRecognize(canvas)); }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const take = (k: Target) => {
    const val = detected[k];
    if (!val) return;
    setAssigned(prev => ({ ...prev, [k]: val }));
    setDetected(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const openModal = () => { setDetected({}); setAssigned({}); setCamError(null); setEngineReady(false); setEngineMsg('인식 엔진 준비 중…'); setOpen(true); };
  const closeModal = () => { stopAll(); setOpen(false); };
  const apply = () => { if (Object.keys(assigned).length === 0) return; onApply(assigned); closeModal(); };

  const resultChips = (dark: boolean) => TARGETS.filter(t => detected[t.key]).map(t => (
    <button key={t.key} type="button" onClick={() => take(t.key)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.5rem 0.65rem',
        borderRadius: '10px', border: dark ? 'none' : '1px solid var(--accent)', cursor: 'pointer', textAlign: 'left',
        background: dark ? 'rgba(10,132,255,0.94)' : 'var(--accent-soft-bg)', color: dark ? '#fff' : 'var(--accent)',
        boxShadow: dark ? '0 2px 10px rgba(0,0,0,0.3)' : 'none',
      }}>
      <span style={{ flexShrink: 0 }}>{t.icon}</span>
      <span style={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 700, opacity: 0.9 }}>{t.label}</span>
      <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 800, color: dark ? '#fff' : 'var(--text-primary)', wordBreak: 'break-all' }}>{detected[t.key]}</span>
      <span style={{ flexShrink: 0, fontSize: '0.66rem', fontWeight: 700, opacity: 0.9 }}>탭하여 입력 ›</span>
    </button>
  ));

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="라벨 스캔"
        style={compact ? {
          display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.7rem',
          borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
          border: '1px solid var(--accent-soft-border)', background: 'var(--accent-soft-bg)',
          color: 'var(--accent)', cursor: 'pointer', flexShrink: 0,
        } : {
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          width: '100%', padding: '0.6rem', marginBottom: '0.6rem',
          borderRadius: '10px', border: '1px solid var(--accent)',
          background: 'var(--accent-soft-bg)', color: 'var(--accent)',
          fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
        }}
      >
        <Camera size={compact ? 14 : 15} /> {compact ? '스캔' : '카메라로 라벨 스캔'}
      </button>

      {open && (
        <div className="modal-overlay" onClick={closeModal}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }} className="modal-content" onClick={e => e.stopPropagation()}
          >
            <div className="ios-modal-header">
              <button className="ios-text-btn" onClick={closeModal}><X size={18} /></button>
              <div className="ios-modal-title">라벨 스캔</div>
              <button className="ios-text-btn bold" onClick={apply} disabled={Object.keys(assigned).length === 0}>적용</button>
            </div>

            {/* 담긴 항목 */}
            {Object.keys(assigned).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.55rem' }}>
                {TARGETS.map(t => assigned[t.key] ? (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', background: 'var(--accent-soft-bg)', borderRadius: '8px', padding: '0.3rem 0.5rem' }}>
                    <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--accent)', minWidth: '54px' }}>{t.label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all', flex: 1 }}>{assigned[t.key]}</span>
                    <button type="button" onClick={() => setAssigned(prev => { const n = { ...prev }; delete n[t.key]; return n; })}
                      style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.1rem' }}>
                      <X size={13} />
                    </button>
                  </div>
                ) : null)}
              </div>
            )}

            {!camError ? (
              <>
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                  <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', display: 'block', minHeight: '200px' }} />

                  {/* 엔진 로딩 상태 */}
                  {!engineReady && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>
                      <Loader2 size={22} className="spin" /> {engineMsg}
                      <span style={{ fontSize: '0.66rem', fontWeight: 600, opacity: 0.8 }}>처음 한 번만 받아옵니다</span>
                    </div>
                  )}

                  {/* 분석 중 표시 */}
                  {engineReady && scanning && (
                    <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.66rem', fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '0.18rem 0.5rem', borderRadius: '999px' }}>
                      <Loader2 size={11} className="spin" /> 분석 중
                    </div>
                  )}

                  {/* 결과 칩 — 탭하면 바로 입력 */}
                  {engineReady && (
                    <div style={{ position: 'absolute', left: '0.5rem', right: '0.5rem', bottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {resultChips(true)}
                      {Object.keys(detected).length === 0 && (
                        <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: '10px', padding: '0.45rem' }}>
                          라벨을 비추면 모델명·시리얼·사이즈가 떠요
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 지금 분석(고해상도 1회) + 사진 선택 */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <button type="button" onClick={analyzeNow} disabled={!engineReady || scanning}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.7rem', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.84rem', fontWeight: 800, cursor: engineReady && !scanning ? 'pointer' : 'default', opacity: engineReady && !scanning ? 1 : 0.6 }}>
                    <Camera size={16} /> 지금 분석
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    title="사진에서 선택"
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.7rem 0.85rem', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'var(--surface-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <ImageIcon size={15} /> 사진
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) runFileOcr(f); e.target.value = ''; }} />
              </>
            ) : (
              // 카메라 불가 → 안내 + 다시 시도 + 사진 선택
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5, margin: '0.4rem 0' }}>{camError}</p>
                {Object.keys(detected).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>{resultChips(false)}</div>}
                <button type="button" onClick={startLive}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--accent)', background: 'var(--accent-soft-bg)', color: 'var(--accent)', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}>
                  <RefreshCw size={15} /> 카메라 다시 시도
                </button>
                <button type="button" onClick={() => fileRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px dashed var(--panel-border)', background: 'var(--surface-color)', color: 'var(--text-secondary)', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}>
                  {scanning ? <><Loader2 size={15} className="spin" /> 분석 중…</> : <><ImageIcon size={15} /> 사진에서 선택</>}
                </button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) runFileOcr(f); e.target.value = ''; }} />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
