'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Loader2, RotateCcw } from 'lucide-react';
import { autoClassifyTokens } from '@/frontend/utils/inventory';

type Target = 'code' | 'title' | 'serial';

const TARGETS: { key: Target; label: string }[] = [
  { key: 'code', label: '모델명(코드)' },
  { key: 'title', label: '품목명(사이즈)' },
  { key: 'serial', label: '시리얼' },
];

/** 캡처한 이미지에서 인식된 단어 하나 — 이미지 위 해시태그 칩으로 띄운다. */
interface Chip {
  text: string;
  // 캡처 이미지 대비 비율(%) — 반응형 배치
  left: number; top: number; w: number; h: number;
}

/**
 * 카메라 라벨 스캔(촬영→정밀 인식).
 * 라이브 미리보기에서 객체를 비추고 '촬영'을 누르면 고해상도 한 장을 잡아 한 번만 정밀 OCR한다
 * (저해상도 프레임을 계속 인식하던 방식보다 정확). 인식된 단어가 캡처 이미지 위에 #태그로 떠서,
 * 탭하면 모델명(코드)/품목명/시리얼 중 무엇인지 골라 담고 '적용'한다.
 * 카메라를 못 쓰는 환경은 사진 파일 선택으로 자동 폴백. OCR은 Tesseract.js(기기 내장·무료).
 */
export default function CameraScan({
  onApply,
  compact = false,
}: {
  onApply: (fields: { code?: string; title?: string; serial?: string }) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null); // 캡처 이미지 dataURL
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chips, setChips] = useState<Chip[]>([]);
  const [picker, setPicker] = useState<Chip | null>(null);
  const [assigned, setAssigned] = useState<{ code?: string; title?: string; serial?: string }>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setLiveError(true);
    }
  };

  useEffect(() => {
    if (open && !captured) startLive();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, captured]);

  // OCR 공통 — 이미지/캔버스를 받아 단어 칩으로 변환
  const recognize = async (source: HTMLCanvasElement | HTMLImageElement, dispW: number, dispH: number) => {
    setBusy(true); setProgress(0); setChips([]);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => { if (m.status === 'recognizing text') setProgress(Math.round((m.progress || 0) * 100)); },
      });
      // 흩어진 라벨 텍스트에 강한 sparse 모드
      await worker.setParameters({ tessedit_pageseg_mode: '11' as any });
      const { data } = await worker.recognize(source);
      await worker.terminate();
      const seen = new Set<string>();
      const next: Chip[] = [];
      (data.words || []).forEach((w: any) => {
        const t = (w.text || '').trim();
        if (t.length < 2 || (w.confidence ?? 0) < 40 || seen.has(t)) return;
        seen.add(t);
        const b = w.bbox || {};
        next.push({
          text: t,
          left: (b.x0 / dispW) * 100,
          top: (b.y0 / dispH) * 100,
          w: ((b.x1 - b.x0) / dispW) * 100,
          h: ((b.y1 - b.y0) / dispH) * 100,
        });
      });
      setChips(next);
      // 알고리즘 자동 분류 — 코드/시리얼/사이즈를 패턴으로 미리 담아둔다(사용자가 탭해 수정 가능)
      const auto = autoClassifyTokens(next.map(c => c.text));
      if (Object.keys(auto).length > 0) setAssigned(prev => ({ ...auto, ...prev }));
    } catch {
      setChips([]);
    }
    setBusy(false);
  };

  // 라이브 프레임을 고해상도로 캡처 → 정밀 OCR
  const capture = async () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    setCaptured(canvas.toDataURL('image/jpeg', 0.92));
    stopStream();
    await recognize(canvas, canvas.width, canvas.height);
  };

  // 사진 파일 폴백 OCR
  const runFileOcr = (file: File) => {
    const img = new Image();
    img.onload = async () => {
      setCaptured(img.src);
      await recognize(img, img.naturalWidth, img.naturalHeight);
    };
    img.src = URL.createObjectURL(file);
  };

  const retake = () => { setCaptured(null); setChips([]); setPicker(null); };

  const assign = (key: Target, value: string) => {
    setAssigned(prev => ({ ...prev, [key]: value }));
    setPicker(null);
  };

  const openModal = () => {
    setCaptured(null); setChips([]); setAssigned({}); setPicker(null); setLiveError(false); setBusy(false);
    setOpen(true);
  };
  const closeModal = () => { stopStream(); setOpen(false); };
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
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}
                     onClick={() => setPicker(null)}>
                  {/* 라이브 미리보기(촬영 전) / 캡처 이미지(촬영 후) */}
                  {!captured ? (
                    <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} />
                  ) : (
                    <img src={captured} alt="" style={{ width: '100%', display: 'block' }} />
                  )}

                  {/* 캡처 이미지 위 해시태그 칩 */}
                  {captured && chips.map((c, i) => (
                    <button
                      key={`${c.text}_${i}`}
                      type="button"
                      onClick={e => { e.stopPropagation(); setPicker(c); }}
                      style={{
                        position: 'absolute',
                        left: `${Math.max(1, Math.min(88, c.left))}%`,
                        top: `${Math.max(1, Math.min(92, c.top))}%`,
                        fontSize: '0.74rem', fontWeight: 800, padding: '0.16rem 0.5rem', borderRadius: '999px',
                        border: assigned.code === c.text || assigned.title === c.text || assigned.serial === c.text
                          ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.5)',
                        background: assigned.code === c.text || assigned.title === c.text || assigned.serial === c.text
                          ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                        color: '#fff', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                        cursor: 'pointer', maxWidth: '72%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      #{c.text}
                    </button>
                  ))}

                  {busy && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>
                      <Loader2 size={22} className="spin" /> 정밀 인식 중… {progress}%
                    </div>
                  )}

                  {/* 칩 분류 선택 바 */}
                  {picker && (
                    <div onClick={e => e.stopPropagation()}
                         style={{ position: 'absolute', left: '0.5rem', right: '0.5rem', bottom: '0.5rem', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: '12px', padding: '0.55rem 0.6rem' }}>
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

                {/* 액션 버튼 */}
                {!captured ? (
                  <button type="button" onClick={capture}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', marginTop: '0.6rem', padding: '0.85rem', borderRadius: '12px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer' }}>
                    <Camera size={18} /> 촬영해서 인식
                  </button>
                ) : (
                  <button type="button" onClick={retake} disabled={busy}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', marginTop: '0.6rem', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--panel-border)', background: 'var(--surface-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
                    <RotateCcw size={15} /> 다시 촬영
                  </button>
                )}

                <p style={{ marginTop: '0.55rem', fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                  {!captured
                    ? '라벨이 또렷하게 보이게 맞춘 뒤 ‘촬영해서 인식’을 누르세요.'
                    : (busy ? '인식이 끝나면 #태그를 탭해 항목으로 담으세요.'
                            : (chips.length > 0 ? '#태그를 탭해 모델명·품목명·시리얼로 담고 ‘적용’.' : '인식된 글자가 없어요. 더 가까이서 다시 촬영해 보세요.'))}
                </p>
              </>
            ) : (
              <>
                {/* 카메라 불가 → 사진 파일 OCR 폴백 */}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) runFileOcr(f); e.target.value = ''; }} />

                {captured && (
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', marginBottom: '0.6rem' }} onClick={() => setPicker(null)}>
                    <img src={captured} alt="" style={{ width: '100%', display: 'block' }} />
                    {chips.map((c, i) => (
                      <button key={`${c.text}_${i}`} type="button" onClick={e => { e.stopPropagation(); setPicker(c); }}
                        style={{ position: 'absolute', left: `${Math.max(1, Math.min(88, c.left))}%`, top: `${Math.max(1, Math.min(92, c.top))}%`, fontSize: '0.74rem', fontWeight: 800, padding: '0.16rem 0.5rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', maxWidth: '72%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{c.text}
                      </button>
                    ))}
                    {picker && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '0.5rem', right: '0.5rem', bottom: '0.5rem', background: 'rgba(0,0,0,0.8)', borderRadius: '12px', padding: '0.55rem 0.6rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', marginBottom: '0.45rem', wordBreak: 'break-all' }}>“{picker.text}” 항목 선택</div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {TARGETS.map(t => (
                            <button key={t.key} type="button" onClick={() => assign(t.key, picker.text)} style={{ flex: 1, minWidth: '90px', fontSize: '0.72rem', fontWeight: 700, padding: '0.4rem 0.3rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>{t.label}</button>
                          ))}
                          <button type="button" onClick={() => setPicker(null)} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.4rem 0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>취소</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px dashed var(--panel-border)', background: 'var(--surface-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
                  {busy ? <><Loader2 size={16} className="spin" /> 인식 중… {progress}%</> : <><Camera size={16} /> {captured ? '다른 사진으로 다시' : '사진 촬영 / 선택'}</>}
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
