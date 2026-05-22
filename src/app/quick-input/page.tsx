"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Calendar, Package, FileText, Settings, LogOut } from 'lucide-react';

export default function QuickInputPage() {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input immediately on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Bind global escape key to close/hide
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const ipc = (window as any).ipcRenderer;
        if (ipc) {
          ipc.send('quick-nlp-close');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Bind IPC event to clear input when window is hidden/shown
    const ipc = (window as any).ipcRenderer;
    if (ipc) {
      const onClear = () => {
        setValue('');
        if (inputRef.current) {
          inputRef.current.focus();
        }
      };
      ipc.on('clear-quick-input', onClear);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        ipc.removeListener('clear-quick-input', onClear);
      };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    const ipc = (window as any).ipcRenderer;
    if (ipc) {
      ipc.send('quick-nlp-submit', value);
    }
    setValue('');
  };

  const handleAction = (action: string) => {
    const ipc = (window as any).ipcRenderer;
    if (ipc) {
      ipc.send('quick-action', action);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      overflow: 'hidden',
      padding: '8px',
      boxSizing: 'border-box'
    }}>
      <style>{`
        .quick-panel-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(245, 245, 247, 0.9);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 12px;
          padding: 8px 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          box-sizing: border-box;
        }
        .quick-form {
          width: 100%;
          display: flex;
          align-items: center;
          background: #FFFFFF;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 8px;
          padding: 6px 10px;
          box-sizing: border-box;
        }
        .quick-logo-circle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1.5px solid #34C759;
          margin-right: 8px;
          flex-shrink: 0;
        }
        .quick-logo-check {
          font-size: 9px;
          color: #34C759;
          font-weight: bold;
          transform: translateY(-0.5px);
        }
        .quick-input-field {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #1D1D1F;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          padding: 0;
        }
        .quick-input-field::placeholder {
          color: #8E8E93;
        }
        .quick-submit-btn {
          background: #34C759;
          border: none;
          outline: none;
          color: #FFFFFF;
          border-radius: 5px;
          padding: 3px 7px;
          font-size: 10px;
          font-weight: bold;
          cursor: pointer;
          margin-left: 6px;
          transition: background 0.2s;
        }
        .quick-submit-btn:hover {
          background: #28b84e;
        }
        .quick-actions-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2px 2px 2px;
          gap: 5px;
        }
        .quick-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #FFFFFF;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 6px;
          color: #1D1D1F;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 9px;
          cursor: pointer;
          transition: all 0.15s ease;
          outline: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .quick-action-btn:hover {
          background: #F5F5F7;
          border-color: rgba(0, 0, 0, 0.18);
          color: #000000;
          transform: translateY(-0.5px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
        }
        .quick-action-btn:active {
          background: #E8E8ED;
          transform: translateY(0.5px);
          box-shadow: none;
        }
        .quick-action-quit {
          color: #FF3B30 !important;
          background: #FFFFFF !important;
          border-color: rgba(0, 0, 0, 0.12) !important;
        }
        .quick-action-quit:hover {
          background: #FFECEB !important;
          border-color: rgba(255, 59, 48, 0.25) !important;
          color: #FF3B30 !important;
        }
      `}</style>
      <div className="quick-panel-container">
        {/* Row 1: NLP Input Form */}
        <form onSubmit={handleSubmit} className="quick-form">
          <div className="quick-logo-circle">
            <span className="quick-logo-check">✓</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="일정, 메모, 재고를 자연스러운 문장으로 입력해보세요..."
            className="quick-input-field"
          />
          {value.trim() && (
            <button type="submit" className="quick-submit-btn">
              등록
            </button>
          )}
        </form>

        {/* Row 2: Action Buttons */}
        <div className="quick-actions-row">
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction('open')}
          >
            <ExternalLink size={11} style={{ marginRight: '3px' }} />
            열기
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction('new-schedule')}
          >
            <Calendar size={11} style={{ marginRight: '3px' }} />
            일정
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction('new-inventory')}
          >
            <Package size={11} style={{ marginRight: '3px' }} />
            재고
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction('new-memo')}
          >
            <FileText size={11} style={{ marginRight: '3px' }} />
            메모
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction('settings')}
          >
            <Settings size={11} style={{ marginRight: '3px' }} />
            설정
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="quick-action-btn quick-action-quit"
            onClick={() => handleAction('quit')}
          >
            <LogOut size={11} style={{ marginRight: '3px' }} />
            종료
          </button>
        </div>
      </div>
    </div>
  );
}
