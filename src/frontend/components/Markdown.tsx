"use client";

import React from 'react';

/**
 * 의존성 없는 경량 Markdown 렌더러.
 * 지원: 제목(#,##,###), 굵게(**), 기울임(*,_), 취소선(~~), 인라인 코드(`),
 *       링크([t](u)), 체크박스(- [ ] / - [x]), 불릿(-,*), 번호목록(1.),
 *       인용(>), 구분선(---), 단락/줄바꿈, 테이블(표), 펜스 코드 블록.
 * 카드 미리보기와 상세 보기 모두에서 재사용.
 */

let keyCounter = 0;
const nextKey = () => `md-${keyCounter++}`;

// 인라인 파싱: 굵게/기울임/코드/링크/취소선/해시태그/@멘션
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // 순서 중요: 코드 → 링크 → 굵게 → 취소선 → 기울임 → 해시태그 → @멘션(큰따옴표/작은따옴표/일반단어)
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|(_[^_]+_)|(#[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣_]+)|(@"[^"\n]+")|(@'[^'\n]+')|(@[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣_]+)/;
  let remaining = text;

  while (remaining.length > 0) {
    const match = remaining.match(pattern);
    if (!match || match.index === undefined) {
      nodes.push(remaining);
      break;
    }
    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }
    const token = match[0];

    if (token.startsWith('`')) {
      nodes.push(
        <code key={nextKey()} style={{ background: 'var(--row-bg)', borderRadius: '4px', padding: '0.05rem 0.3rem', fontSize: '0.92em', fontFamily: 'ui-monospace, monospace' }}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const m = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (m) {
        nodes.push(
          <a key={nextKey()} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
            {m[1]}
          </a>
        );
      }
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={nextKey()} style={{ fontWeight: 800 }}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('~~')) {
      nodes.push(<span key={nextKey()} style={{ textDecoration: 'line-through', opacity: 0.7 }}>{token.slice(2, -2)}</span>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={nextKey()} style={{ fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('_')) {
      nodes.push(<em key={nextKey()} style={{ fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('#')) {
      const tagText = token.slice(1);
      nodes.push(
        <span 
          key={nextKey()} 
          style={{ 
            color: 'var(--accent)', 
            background: 'var(--accent-soft-bg)', 
            padding: '0.05rem 0.35rem', 
            borderRadius: '4px', 
            fontSize: '0.85em', 
            fontWeight: 700, 
            cursor: 'pointer',
            display: 'inline-block',
            margin: '0 0.1rem',
            userSelect: 'none',
            border: '1px solid rgba(0, 122, 255, 0.15)'
          }}
          onClick={(e) => {
            e.stopPropagation();
            const event = new CustomEvent('filter-by-tag', { detail: tagText });
            window.dispatchEvent(event);
          }}
        >
          #{tagText}
        </span>
      );
    } else if (token.startsWith('@')) {
      let mentionName = token.slice(1);
      if ((mentionName.startsWith('"') && mentionName.endsWith('"')) || 
          (mentionName.startsWith("'") && mentionName.endsWith("'"))) {
        mentionName = mentionName.slice(1, -1);
      }
      nodes.push(
        <span 
          key={nextKey()} 
          style={{ 
            color: 'var(--accent, #007aff)', 
            background: 'var(--accent-soft-bg, rgba(0, 122, 255, 0.08))', 
            padding: '0.05rem 0.35rem', 
            borderRadius: '4px', 
            fontSize: '0.85em', 
            fontWeight: 700, 
            cursor: 'pointer',
            display: 'inline-block',
            margin: '0 0.1rem',
            userSelect: 'none',
            border: '1px solid rgba(0, 122, 255, 0.15)'
          }}
          onClick={(e) => {
            e.stopPropagation();
            const event = new CustomEvent('mention-click', { detail: mentionName });
            window.dispatchEvent(event);
          }}
        >
          @{mentionName}
        </span>
      );
    }
    remaining = remaining.slice(match.index + token.length);
  }
  return nodes;
}

// 테이블 셀 분리 및 정렬 파싱 헬퍼 함수
function splitCells(line: string): string[] {
  let clean = line.trim();
  if (clean.startsWith('|')) clean = clean.slice(1);
  if (clean.endsWith('|')) clean = clean.slice(0, -1);
  return clean.split('|').map(s => s.trim());
}

function parseAlign(cell: string): 'left' | 'center' | 'right' | null {
  const trimmed = cell.trim();
  const starts = trimmed.startsWith(':');
  const ends = trimmed.endsWith(':');
  if (starts && ends) return 'center';
  if (starts) return 'left';
  if (ends) return 'right';
  return null;
}

function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  return /^[|:\-\s]+$/.test(trimmed) && trimmed.replace(/[|:\s]/g, '').length > 0;
}

export default function Markdown({ 
  content, 
  compact = false,
  onCheckboxToggle
}: { 
  content: string; 
  compact?: boolean; 
  onCheckboxToggle?: (lineIndex: number, newCheckedState: boolean) => void;
}) {
  if (!content) return null;
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  let listBuffer: { ordered: boolean; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (listBuffer) {
      const Tag = listBuffer.ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={nextKey()} style={{ margin: '0.2rem 0', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          {listBuffer.items}
        </Tag>
      );
      listBuffer = null;
    }
  };

  const mb = compact ? '0.1rem' : '0.35rem';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    // 1. 빈 줄
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // 2. 펜스 코드 블록 (```)
    if (line.startsWith('```')) {
      flushList();
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith('```')) {
        codeLines.push(lines[j]);
        j++;
      }
      i = j; // 닫는 ``` 위치 혹은 끝으로 인덱스 이동

      blocks.push(
        <div key={nextKey()} style={{ margin: '0.5rem 0', position: 'relative' }}>
          {lang && (
            <span style={{ 
              position: 'absolute', 
              top: '0', 
              right: '0.6rem', 
              fontSize: '0.62rem', 
              color: 'var(--text-tertiary)', 
              background: 'var(--panel-border)', 
              padding: '0.1rem 0.3rem', 
              borderRadius: '0 0 4px 4px',
              textTransform: 'uppercase',
              fontWeight: 700
            }}>
              {lang}
            </span>
          )}
          <pre style={{ 
            background: 'var(--hover-bg)', 
            border: '1px solid var(--panel-border)', 
            borderRadius: '6px', 
            padding: '0.6rem', 
            overflowX: 'auto', 
            fontSize: '0.72rem', 
            fontFamily: 'ui-monospace, monospace',
            lineHeight: '1.4',
            margin: 0
          }}>
            <code style={{ color: 'var(--text-primary)', whiteSpace: 'pre' }}>
              {codeLines.join('\n')}
            </code>
          </pre>
        </div>
      );
      continue;
    }

    // 3. 테이블 (표) 감지
    // 현재 줄에 '|'가 있고 다음 줄이 유효한 구분선일 때 테이블 시작
    if (line.includes('|') && i + 1 < lines.length && isSeparatorLine(lines[i + 1])) {
      flushList();
      
      const headers = splitCells(lines[i]);
      const alignCells = splitCells(lines[i + 1]);
      const alignments = alignCells.map(parseAlign);

      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim() !== '' && lines[j].includes('|') && !isSeparatorLine(lines[j])) {
        rows.push(splitCells(lines[j]));
        j++;
      }
      i = j - 1; // 테이블이 끝난 위치로 인덱스 이동

      blocks.push(
        <div key={nextKey()} style={{ overflowX: 'auto', margin: '0.5rem 0', maxWidth: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? '0.7rem' : '0.78rem', margin: '0.2rem 0' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--panel-border)', background: 'var(--hover-bg)' }}>
                {headers.map((h, colIdx) => (
                  <th 
                    key={nextKey()} 
                    style={{ 
                      padding: '0.4rem 0.6rem', 
                      fontWeight: 600, 
                      textAlign: alignments[colIdx] || 'left',
                      color: 'var(--text-primary)',
                      borderBottom: '1.5px solid var(--panel-border)'
                    }}
                  >
                    {parseInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr 
                  key={nextKey()} 
                  style={{ 
                    borderBottom: '1px solid var(--panel-border)',
                    background: rowIdx % 2 === 1 ? 'var(--hover-bg)' : 'transparent' // 테마 변수를 활용한 미세한 홀수행 배경
                  }}
                >
                  {headers.map((_, colIdx) => (
                    <td 
                      key={nextKey()} 
                      style={{ 
                        padding: '0.4rem 0.6rem', 
                        textAlign: alignments[colIdx] || 'left',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {parseInline(row[colIdx] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 4. 구분선 (---)
    if (/^---+$/.test(line.trim())) {
      flushList();
      blocks.push(<hr key={nextKey()} style={{ border: 'none', borderTop: '1px solid var(--panel-border)', margin: '0.4rem 0' }} />);
      continue;
    }

    // 5. 체크박스
    const checkMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (checkMatch) {
      flushList();
      const checked = checkMatch[1].toLowerCase() === 'x';
      blocks.push(
        <div key={nextKey()} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', margin: '0.05rem 0' }}>
          <span 
            onClick={(e) => {
              if (onCheckboxToggle) {
                e.stopPropagation();
                onCheckboxToggle(i, !checked);
              }
            }}
            style={{
              width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0, marginTop: '0.15rem',
              border: `1.5px solid ${checked ? 'var(--success)' : 'var(--text-tertiary)'}`,
              background: checked ? 'var(--success)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '0.6rem', fontWeight: 900,
              cursor: onCheckboxToggle ? 'pointer' : 'default'
            }}
          >
            {checked ? '✓' : ''}
          </span>
          <span style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1 }}>
            {parseInline(checkMatch[2])}
          </span>
        </div>
      );
      continue;
    }

    // 6. 제목
    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      const size = level === 1 ? '1.05rem' : level === 2 ? '0.95rem' : '0.85rem';
      blocks.push(
        <div key={nextKey()} style={{ fontSize: size, fontWeight: 800, color: 'var(--text-primary)', margin: `${mb} 0 0.15rem` }}>
          {parseInline(hMatch[2])}
        </div>
      );
      continue;
    }

    // 7. 인용
    if (line.startsWith('> ')) {
      flushList();
      blocks.push(
        <div key={nextKey()} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '0.6rem', color: 'var(--text-secondary)', margin: `${mb} 0`, fontStyle: 'italic' }}>
          {parseInline(line.slice(2))}
        </div>
      );
      continue;
    }

    // 8. 번호 목록
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!listBuffer || !listBuffer.ordered) { flushList(); listBuffer = { ordered: true, items: [] }; }
      listBuffer.items.push(<li key={nextKey()} style={{ fontSize: 'inherit' }}>{parseInline(olMatch[1])}</li>);
      continue;
    }

    // 9. 불릿 목록
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!listBuffer || listBuffer.ordered) { flushList(); listBuffer = { ordered: false, items: [] }; }
      listBuffer.items.push(<li key={nextKey()} style={{ fontSize: 'inherit' }}>{parseInline(ulMatch[1])}</li>);
      continue;
    }

    // 10. 일반 단락
    flushList();
    blocks.push(
      <div key={nextKey()} style={{ margin: `${mb} 0` }}>
        {parseInline(line)}
      </div>
    );
  }

  flushList();

  return <div className="md-body" style={{ wordBreak: 'break-word' }}>{blocks}</div>;
}
