/** A labelled number input, used wherever a routine's numbers are edited. */

import type { JSX } from 'react';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Shown after the field, e.g. `°` or `s`. */
  unit?: string;
  /** Marks the field when the value it holds is part of a blocking issue. */
  invalid?: boolean;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  invalid = false,
  disabled = false,
}: NumberFieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted first-letter:uppercase">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          className={`field ${invalid ? 'border-safety' : ''}`}
          inputMode="numeric"
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
        />
        {unit ? <span className="text-sm text-muted">{unit}</span> : null}
      </span>
    </label>
  );
}
