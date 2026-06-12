'use client';

import { useRef } from 'react';

export function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  function setDigit(index: number, char: string) {
    const clean = char.replace(/\D/g, '').slice(-1);
    const arr = digits.map((d) => (d === ' ' ? '' : d));
    arr[index] = clean;
    onChange(arr.join('').slice(0, 6));
    if (clean && index < 5) inputs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) onChange(pasted);
  }

  return (
    <div className="flex gap-2 justify-between" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          className="w-11 h-12 text-center text-lg font-semibold rounded-xl bg-white/5 border border-white/15 text-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50"
        />
      ))}
    </div>
  );
}
