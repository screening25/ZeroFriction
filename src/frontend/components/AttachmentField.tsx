'use client';

import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import type { AttachmentMeta } from '@/database';

// 서버(/api/files) 한도와 동일 — Vercel 요청 본문 한도(4.5MB) 내
const MAX_FILE_SIZE = 4 * 1024 * 1024;

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

/**
 * 일정·메모 첨부파일 필드 — 파일 본문은 /api/files 에 올리고 메타데이터만 onChange로 전달한다.
 * 칩 클릭 = 새 탭에서 열기/다운로드, X = 목록 제거(서버 본문도 삭제). readOnly면 보기 전용.
 */
export default function AttachmentField({
  files,
  onChange,
  readOnly,
}: {
  files: AttachmentMeta[];
  onChange?: (files: AttachmentMeta[]) => void;
  readOnly?: boolean;
}) {
  const { showToast } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleSelect = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    const added: AttachmentMeta[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_SIZE) {
        showToast(`'${file.name}'은(는) 4MB를 초과해 첨부할 수 없습니다.`);
        continue;
      }
      try {
        const res = await fetch(
          `/api/files?name=${encodeURIComponent(file.name)}&mime=${encodeURIComponent(file.type || 'application/octet-stream')}`,
          { method: 'POST', body: file }
        );
        if (!res.ok) throw new Error(`upload failed (${res.status})`);
        added.push(await res.json());
      } catch (e) {
        console.error('[files] upload failed', file.name, e);
        showToast(`'${file.name}' 업로드에 실패했습니다.`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (added.length > 0) {
      onChange?.([...files, ...added]);
      showToast(`파일 ${added.length}개 첨부 완료`);
    }
  };

  const removeFile = (id: string) => {
    onChange?.(files.filter(f => f.id !== id));
    // 본문은 서버에서도 정리한다(실패해도 목록 제거는 유지).
    fetch(`/api/files/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  if (readOnly && files.length === 0) return null;

  return (
    <div className="form-group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="form-label">첨부 파일{files.length > 0 ? ` (${files.length})` : ''}</span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: '6px',
              padding: '0.15rem 0.45rem',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              cursor: uploading ? 'wait' : 'pointer',
              opacity: uploading ? 0.6 : 1
            }}
          >
            <Paperclip size={11} />
            {uploading ? '업로드 중…' : '파일 추가'}
          </button>
        )}
      </div>
      {!readOnly && (
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleSelect(e.target.files)} />
      )}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
          {files.map(f => (
            <span
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                maxWidth: '100%',
                padding: '0.25rem 0.5rem',
                borderRadius: '8px',
                border: '1px solid var(--panel-border)',
                background: 'var(--bg-secondary)',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-secondary)'
              }}
            >
              <Paperclip size={10} style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <a
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={`${f.name} (${formatSize(f.size)})`}
              >
                {f.name}
              </a>
              <span style={{ flexShrink: 0, color: 'var(--text-tertiary)', fontSize: '0.62rem' }}>{formatSize(f.size)}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  title="첨부 제거"
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
