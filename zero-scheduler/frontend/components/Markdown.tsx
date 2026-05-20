"use client";

import React from 'react';

/**
 * 의존성 없는 경량 Markdown 렌더러.
 * 지원: 제목(#,##,###), 굵게(**), 기울임(*,_), 취소선(~~), 인라인 코드(`),
 *       링크([t](u)), 체크박스(- [ ] / - [x]), 불릿(-,*), 번호목록(1.),
 *       인용(>), 구분선(---), 단락/줄바꿈.
 * 카드 미리보기와 상세 보기 모두에서 재사용.
 */

let keyCounter = 0;
const nextKey = () => `md-${keyCounter++}`;

// 인라인 파싱: 굵게/기울임/코드/링크/취소선
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // 순서 중요: 코드 → 링크 → 굵게 → 취소선 → 기울임
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|(_[^_]+_)/;
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
    }
    remaining = remaining.slice(match.index + token.length);
  }
  return nodes;
}

export default function Markdown({ content, compact = false }: { content: string; compact?: boolean }) {
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

  lines.forEach(rawLine => {
    const line = rawLine.trimEnd();

    // 빈 줄
    if (line.trim() === '') { flushList(); return; }

    // 구분선
    if (/^---+$/.test(line.trim())) {
      flushList();
      blocks.push(<hr key={nextKey()} style={{ border: 'none', borderTop: '1px solid var(--panel-border)', margin: '0.4rem 0' }} />);
      return;
    }

    // 체크박스
    const checkMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (checkMatch) {
      flushList();
      const checked = checkMatch[1].toLowerCase() === 'x';
      blocks.push(
        <div key={nextKey()} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', margin: '0.05rem 0' }}>
          <span style={{
            width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0, marginTop: '0.15rem',
            border: `1.5px solid ${checked ? 'var(--success)' : 'var(--text-tertiary)'}`,
            background: checked ? 'var(--success)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '0.6rem', fontWeight: 900
          }}>{checked ? '✓' : ''}</span>
          <span style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1 }}>
            {parseInline(checkMatch[2])}
          </span>
        </div>
      );
      return;
    }

    // 제목
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
      return;
    }

    // 인용
    if (line.startsWith('> ')) {
      flushList();
      blocks.push(
        <div key={nextKey()} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '0.6rem', color: 'var(--text-secondary)', margin: `${mb} 0`, fontStyle: 'italic' }}>
          {parseInline(line.slice(2))}
        </div>
      );
      return;
    }

    // 번호 목록
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!listBuffer || !listBuffer.ordered) { flushList(); listBuffer = { ordered: true, items: [] }; }
      listBuffer.items.push(<li key={nextKey()} style={{ fontSize: 'inherit' }}>{parseInline(olMatch[1])}</li>);
      return;
    }

    // 불릿 목록
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!listBuffer || listBuffer.ordered) { flushList(); listBuffer = { ordered: false, items: [] }; }
      listBuffer.items.push(<li key={nextKey()} style={{ fontSize: 'inherit' }}>{parseInline(ulMatch[1])}</li>);
      return;
    }

    // 일반 단락
    flushList();
    blocks.push(
      <div key={nextKey()} style={{ margin: `${mb} 0` }}>
        {parseInline(line)}
      </div>
    );
  });

  flushList();

  return <div className="md-body" style={{ wordBreak: 'break-word' }}>{blocks}</div>;
}
