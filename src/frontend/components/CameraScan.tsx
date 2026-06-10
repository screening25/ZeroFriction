'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Loader2 } from 'lucide-react';

type Target = 'code' | 'title' | 'serial';

const TARGETS: { key: Target; label: string }[] = [
  { key: 'code', label: '모델명(코드)' },
  { key: 'title', label: '사이즈(품목명)' },
  { key: 'serial', label: '시리얼' },
];

/**
 * 카메라/사진으로 품목 라벨을 찍어 OCR(Tesseract.js, 기기 내장·무료)로 텍스트를 인식하고,
 * 인식된 각 줄을 사용자가 직접 모델명(코드)/사이즈(품목명)/시리얼 중 하나로 분류해 폼에 채운다.
 * 무거운 OCR 라이브러리는 사용 시점에 동적 import 한다(초기 번들·SSR 영향 없음).
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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<{ code?: string; title?: string; serial?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setLines([]); setAssigned({}); setProgress(0); setBusy(false); };

  const runOcr = async (file: File) => {
    setBusy(true); setProgress(0); setLines([]); setAssigned({});
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => { if (m.status === 'recognizing text') setProgress(Math.round((m.progress || 0) * 100)); },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const ls = (data.text || '')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length >= 2);
      setLines(Array.from(new Set(ls)));
    } catch (e) {
      setLines([]);
    }
    setBusy(false);
  };

  const assign = (key: Target, value: string) => {
    setAssigned(prev => ({ ...prev, [key]: value }));
  };

  const apply = () => {
    if (Object.keys(assigned).length === 0) return;
    onApply(assigned);
    setOpen(false);
    reset();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
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
        <div className="modal-overlay" onClick={() => { setOpen(false); reset(); }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }} className="modal-content" onClick={e => e.stopPropagation()}
          >
            <div className="ios-modal-header">
              <button className="ios-text-btn" onClick={() => { setOpen(false); reset(); }}><X size={18} /></button>
              <div className="ios-modal-title">라벨 스캔</div>
              <button className="ios-text-btn bold" onClick={apply} disabled={Object.keys(assigned).length === 0}>적용</button>
            </div>

            {/* 사진 촬영/선택 — 모바일은 후면 카메라(capture=environment)로 바로 촬영 */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) runOcr(f); e.target.value = ''; }}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                width: '100%', padding: '0.85rem', borderRadius: '12px',
                border: '1px dashed var(--panel-border)', background: 'var(--surface-color)',
                color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
              }}
            >
              {busy ? <><Loader2 size={16} className="spin" /> 인식 중… {progress}%</> : <><Camera size={16} /> 사진 촬영 / 선택</>}
            </button>

            {/* 현재 분류 결과 */}
            {Object.keys(assigned).length > 0 && (
              <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {TARGETS.map(t => assigned[t.key] ? (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                    <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--accent)', minWidth: '88px' }}>{t.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{assigned[t.key]}</span>
                  </div>
                ) : null)}
              </div>
            )}

            {/* 인식된 줄 목록 — 각 줄을 원하는 필드로 분류 */}
            {lines.length > 0 && (
              <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '46vh', overflowY: 'auto' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>
                  인식된 텍스트 — 각 줄을 어떤 항목인지 선택하세요
                </span>
                {lines.map((line, i) => (
                  <div key={i} style={{ border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '0.5rem 0.6rem', background: 'var(--surface-color)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', wordBreak: 'break-all' }}>{line}</div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {TARGETS.map(t => {
                        const active = assigned[t.key] === line;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => assign(t.key, line)}
                            style={{
                              fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.55rem', borderRadius: '8px',
                              border: active ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
                              background: active ? 'var(--accent-soft-bg)' : 'var(--bg-secondary)',
                              color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer',
                            }}
                          >
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
                품목 라벨(모델명·사이즈·시리얼)이 잘 보이게 촬영하면<br />글자를 인식해 항목별로 분류할 수 있습니다.
              </p>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
