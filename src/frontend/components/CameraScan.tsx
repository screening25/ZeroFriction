'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Loader2 } from 'lucide-react';

type Target = 'code' | 'title' | 'serial';

const TARGETS: { key: Target; label: string }[] = [
  { key: 'code', label: '모델명(코드)' },
  { key: 'title', label: '품목명(사이즈)' },
  { key: 'serial', label: '시리얼' },
];

/** 실시간 카메라 프레임에서 인식된 단어 하나 — 화면 위 해시태그 칩으로 띄운다. */
interface Chip {
  text: string;
  x0: number; y0: number; // 인식 프레임 기준 좌표
  w: number; h: number;   // 인식 프레임 크기(% 배치 환산용)
}

/**
 * 실시간 카메라 라벨 스캔.
 * 카메라 화면 위에 인식된 글자들이 해시태그 칩(#텍스트)으로 떠다니고,
 * 칩을 탭하면 그 글자가 모델명(코드)/품목명/시리얼 중 무엇인지 선택해 담는다.
 * '적용'을 누르면 onApply로 전달(재고 식별/신규 등록에 사용).
 * 카메라를 못 쓰는 환경(권한 거부 등)은 사진 촬영/선택 OCR로 자동 폴백.
 * OCR은 Tesseract.js(기기 내장·무료), 사용 시점에 동적 import.
 */
export default function CameraScan({
  onApply,
  compact = false,
}: {
  onApply: (fields: { code?: string; title?: string; serial?: string }) => void;
  /** true면 섹션 헤더에 맞는 작은 버튼으로 표시 */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [chips, setChips] = useState<Chip[]>([]);
  const [scanning, setScanning] = useState(false);
  const [picker, setPicker] = useState<Chip | null>(null); // 탭한 칩(분류 선택 중)
  const [assigned, setAssigned] = useState<{ code?: string; title?: string; serial?: string }>({});

  // 사진 폴백용
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<any>(null);
  const loopRef = useRef(false);
  const pickerOpenRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  pickerOpenRef.current = !!picker;

  const getWorker = async () => {
    if (!workerRef.current) {
      const { createWorker } = await import('tesseract.js');
      workerRef.current = await createWorker('eng');
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

  // 카메라 프레임을 주기적으로 OCR해 칩을 갱신한다. 칩 선택(분류) 중에는 화면이 안 바뀌게 일시정지.
  const scanLoop = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    while (loopRef.current) {
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && ctx && !pickerOpenRef.current) {
        const scale = Math.min(1, 1000 / v.videoWidth); // 속도를 위해 최대 1000px 폭으로 축소
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        try {
          setScanning(true);
          const worker = await getWorker();
          const { data } = await worker.recognize(canvas);
          if (!loopRef.current) break;
          if (!pickerOpenRef.current) {
            const seen = new Set<string>();
            const next: Chip[] = [];
            (data.words || []).forEach((w: any) => {
              const t = (w.text || '').trim();
              if (t.length < 2 || (w.confidence ?? 0) < 55 || seen.has(t)) return;
              seen.add(t);
              next.push({ text: t, x0: w.bbox?.x0 ?? 0, y0: w.bbox?.y0 ?? 0, w: canvas.width, h: canvas.height });
            });
            setChips(next);
          }
        } catch { /* 프레임 인식 실패는 다음 루프에서 재시도 */ }
        setScanning(false);
      }
      await new Promise(r => setTimeout(r, 350));
    }
  };

  const startLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      loopRef.current = true;
      scanLoop();
    } catch {
      setLiveError(true); // 카메라 불가 → 사진 폴백 UI
    }
  };

  useEffect(() => {
    if (open) startLive();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 사진 1장 OCR (폴백)
  const runOcr = async (file: File) => {
    setBusy(true); setProgress(0); setLines([]);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => { if (m.status === 'recognizing text') setProgress(Math.round((m.progress || 0) * 100)); },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const ls = (data.text || '').split('\n').map((s: string) => s.trim()).filter((s: string) => s.length >= 2);
      setLines(Array.from(new Set(ls)));
    } catch { setLines([]); }
    setBusy(false);
  };

  const assign = (key: Target, value: string) => {
    setAssigned(prev => ({ ...prev, [key]: value }));
    setPicker(null);
  };

  const openModal = () => {
    setChips([]); setAssigned({}); setPicker(null); setLiveError(false); setLines([]); setBusy(false);
    setOpen(true);
  };
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

            {/* 담은 항목 요약 */}
            {Object.keys(assigned).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.55rem' }}>
                {TARGETS.map(t => assigned[t.key] ? (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                    <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--accent)', minWidth: '92px' }}>{t.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all', flex: 1 }}>{assigned[t.key]}</span>
                    <button type="button" onClick={() => setAssigned(prev => { const n = { ...prev }; delete n[t.key]; return n; })}
                      style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.1rem' }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : null)}
              </div>
            )}

            {!liveError ? (
              <>
                {/* 실시간 카메라 + 해시태그 칩 오버레이 */}
                <div
                  style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}
                  onClick={() => setPicker(null)}
                >
                  <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} />

                  {chips.map((c, i) => (
                    <button
                      key={`${c.text}_${i}`}
                      type="button"
                      onClick={e => { e.stopPropagation(); setPicker(c); }}
                      style={{
                        position: 'absolute',
                        left: `${Math.min(82, (c.x0 / c.w) * 100)}%`,
                        top: `${Math.min(90, (c.y0 / c.h) * 100)}%`,
                        fontSize: '0.74rem', fontWeight: 800, padding: '0.18rem 0.5rem', borderRadius: '999px',
                        border: '1px solid rgba(255,255,255,0.45)', background: 'rgba(0,0,0,0.55)', color: '#fff',
                        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                        cursor: 'pointer', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      #{c.text}
                    </button>
                  ))}

                  {scanning && (
                    <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.66rem', fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '0.18rem 0.5rem', borderRadius: '999px' }}>
                      <Loader2 size={11} className="spin" /> 인식 중
                    </div>
                  )}

                  {/* 칩 분류 선택 바 — 탭한 글자를 어떤 항목으로 담을지 */}
                  {picker && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{ position: 'absolute', left: '0.5rem', right: '0.5rem', bottom: '0.5rem', background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: '12px', padding: '0.55rem 0.6rem' }}
                    >
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', marginBottom: '0.45rem', wordBreak: 'break-all' }}>
                        “{picker.text}” 항목 선택
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {TARGETS.map(t => (
                          <button key={t.key} type="button" onClick={() => assign(t.key, picker.text)}
                            style={{ flex: 1, minWidth: '90px', fontSize: '0.72rem', fontWeight: 700, padding: '0.4rem 0.3rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                            {t.label}
                          </button>
                        ))}
                        <button type="button" onClick={() => setPicker(null)}
                          style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.4rem 0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <p style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                  라벨을 비추면 글자가 #태그로 떠요. 태그를 탭해서<br />모델명(코드)·품목명·시리얼로 담은 뒤 ‘적용’을 누르세요.
                </p>
              </>
            ) : (
              <>
                {/* 카메라 불가 → 사진 1장 OCR 폴백 */}
                <input
                  ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) runOcr(f); e.target.value = ''; }}
                />
                <button
                  type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px dashed var(--panel-border)', background: 'var(--surface-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}
                >
                  {busy ? <><Loader2 size={16} className="spin" /> 인식 중… {progress}%</> : <><Camera size={16} /> 사진 촬영 / 선택</>}
                </button>

                {lines.length > 0 && (
                  <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '42vh', overflowY: 'auto' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>인식된 텍스트 — 각 줄을 어떤 항목인지 선택하세요</span>
                    {lines.map((line, i) => (
                      <div key={i} style={{ border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '0.5rem 0.6rem', background: 'var(--surface-color)' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', wordBreak: 'break-all' }}>{line}</div>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {TARGETS.map(t => {
                            const active = assigned[t.key] === line;
                            return (
                              <button key={t.key} type="button" onClick={() => assign(t.key, line)}
                                style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.55rem', borderRadius: '8px', border: active ? '1px solid var(--accent)' : '1px solid var(--panel-border)', background: active ? 'var(--accent-soft-bg)' : 'var(--bg-secondary)', color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!busy && lines.length === 0 && (
                  <p style={{ marginTop: '0.8rem', fontSize: '0.74rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                    카메라를 사용할 수 없어 사진 인식으로 동작합니다.<br />라벨이 잘 보이게 촬영해 주세요.
                  </p>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
