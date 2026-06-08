"use client";

import React from 'react';
import SearchSelect from './SearchSelect';

/**
 * 고객사 선택/입력 위젯 — 범용 SearchSelect의 얇은 래퍼.
 * 일정·재고·메모 편집 폼 공용.
 */
export default function ClientPicker({
  value,
  clients,
  onChange,
}: {
  value: string;
  clients: string[];
  onChange: (v: string) => void;
}) {
  return (
    <SearchSelect
      label="고객사"
      value={value}
      options={clients}
      onChange={onChange}
      placeholder="고객사 검색 또는 직접 입력"
    />
  );
}
