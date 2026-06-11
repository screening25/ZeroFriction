'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Loader2, Check } from 'lucide-react';
import { autoClassifyTokens } from '@/frontend/utils/inventory';

type Target = 'code' | 'title' | 'serial';
type Fields = { code?: string; title?: string; serial?: string };

const TARGETS: { key: Target; label: string; icon: string }[] = [
  { key: 'code', label: '모델명', icon: '📦' },
  { key: 'title', label: '품목명', icon: '🏷' },
  { key: 'serial', label: '시리얼', icon: '#️⃣' },
];

/**
 * 카메라 라벨 스캔(실시간 분석·탭 입력).
 * 카메라를 비추면 프레임을 주기적으로 인식하고, 패턴 알고리즘으로 모델명/시리얼/사이즈로
 * 분류된 것"만" 화면에 결과 칩으로 띄운다(오인식 잡토큰은 패턴에서 걸러져 표시 안 됨 → 실시간이어도 정확).
 * 결과 칩을 탭하면 그 값이 즉시 입력란에 담기고, '적용'으로 폼에 반영한다.
 * 카메라를 못 쓰는 환경은 사진 파일 선택으로 자동 폴백.
 */
export default function CameraScan({
  onApply,
  compact = false,
}: {
  onApply: (fields: Fields) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [busy, setBusy] = useState(false);          // 폴백 OCR 진행 표시
  const [scanning, setScanning] = useState(false);   // 실시간 인식 중 표시
  const [detected, setDetected] = useState<Fields>({}); // 인식·분류된 후보(미입력)
  const [assigned, setAssigned] = useState<Fields>({}); // 탭해서 담은 값

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<any>(null);
  const loopRef = useRef(false);
  const assignedRef = useRef<Fields>({});
  const fileRef = useRef<HTMLInputElement>(null);
  assignedRef.current = assigned;

  const getWorker = async () => {
    if (!workerRef.current) {
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker('eng');
      await w.setParameters({ tessedit_pageseg_mode: '11' as any }); // sparse — 흩어진 라벨에 강함
      workerRef.current = w;
    }
    return workerRef.current;
  };

  const stopAll = () => {
    loopRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    workerRef.current?.terminate?.();
    workerRef.current = null;
  };

  // 실시간 분석 루프 — 프레임을 인식해 '패턴 분류된 것만' detected에 채운다(이미 담은 항목은 건드리지 않음)
  const scanLoop = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    while (loopRef.current) {
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && ctx) {
        const scale = Math.min(1, 1280 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        try {
          setScanning(true);
          const worker = await getWorker();
          const { data } = await worker.recognize(canvas);
          if (!loopRef.current) break;
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
        } catch { /* 다음 프레임 재시도 */ }
        setScanning(false);
      }
      await new Promise(r => setTimeout(r, 700));
    }
  };

  const startLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      loopRef.current = true;
      scanLoop();
    } catch {
      setLiveError(true);
    }
  };

  useEffect(() => {
    if (open && !liveError) startLive();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 사진 파일 폴백 — 1장 인식 후 동일하게 detected에 분류 결과를 채운다
  const runFileOcr = async (file: File) => {
    setBusy(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_pageseg_mode: '11' as any });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const words = (data.text || '').split(/\s+/).map(s => s.trim()).filter(s => s.length >= 2);
      const auto = autoClassifyTokens(words);
      setDetected(prev => ({ ...prev, ...auto }));
    } catch { /* noop */ }
    setBusy(false);
  };

  // 결과 칩 탭 → 입력란에 담고 후보에서 제거
  const take = (k: Target) => {
    const val = detected[k];
    if (!val) return;
    setAssigned(prev => ({ ...prev, [k]: val }));
    setDetected(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const openModal = () => { setDetected({}); setAssigned({}); setLiveError(false); setBusy(false); setOpen(true); };
  const closeModal = () => { stopAll(); setOpen(false); };
  const apply = () => {
    if (Object.keys(assigned).length === 0) return;
    onApply(assigned);
    closeModal();
  };

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

            {/* 담긴 항목 — 탭해서 입력된 값 */}
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

            {!liveError ? (
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} />

                {/* 실시간 인식 표시 */}
                {scanning && (
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.66rem', fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '0.18rem 0.5rem', borderRadius: '999px' }}>
                    <Loader2 size={11} className="spin" /> 분석 중
                  </div>
                )}

                {/* 분석 결과 — 탭하면 바로 입력 */}
                <div style={{ position: 'absolute', left: '0.5rem', right: '0.5rem', bottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {TARGETS.filter(t => detected[t.key]).map(t => (
                    <button key={t.key} type="button" onClick={() => take(t.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.5rem 0.65rem', borderRadius: '10px', border: 'none', background: 'rgba(10,132,255,0.92)', color: '#fff', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                      <span style={{ flexShrink: 0 }}>{t.icon}</span>
                      <span style={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 700, opacity: 0.85 }}>{t.label}</span>
                      <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 800, wordBreak: 'break-all' }}>{detected[t.key]}</span>
                      <span style={{ flexShrink: 0, fontSize: '0.66rem', fontWeight: 700, opacity: 0.9 }}>탭하여 입력 ›</span>
                    </button>
                  ))}
                  {Object.keys(detected).length === 0 && (
                    <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: '10px', padding: '0.45rem' }}>
                      라벨을 비추면 모델명·시리얼·사이즈가 여기에 떠요
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* 카메라 불가 → 사진 파일 폴백 (분석 결과는 동일하게 위 영역에서 탭 입력) */}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) runFileOcr(f); e.target.value = ''; }} />

                {/* 폴백에서의 결과 칩 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.6rem' }}>
                  {TARGETS.filter(t => detected[t.key]).map(t => (
                    <button key={t.key} type="button" onClick={() => take(t.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.5rem 0.65rem', borderRadius: '10px', border: '1px solid var(--accent)', background: 'var(--accent-soft-bg)', color: 'var(--accent)', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ flexShrink: 0 }}>{t.icon}</span>
                      <span style={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 700 }}>{t.label}</span>
                      <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{detected[t.key]}</span>
                      <span style={{ flexShrink: 0, fontSize: '0.66rem', fontWeight: 700 }}>탭하여 입력 ›</span>
                    </button>
                  ))}
                </div>

                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px dashed var(--panel-border)', background: 'var(--surface-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
                  {busy ? <><Loader2 size={16} className="spin" /> 분석 중…</> : <><Camera size={16} /> 사진 촬영 / 선택</>}
                </button>
                <p style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  카메라를 쓸 수 없어 사진 인식으로 동작합니다.
                </p>
              </>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
