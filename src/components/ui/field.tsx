"use client";

import * as React from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Form controls. Fields are 56px tall with the 16px `field` radius, a warm
 * surface-2 fill that turns white on focus, and a dark variant for the
 * charcoal auth card (`tone="dark"`).
 */
export type FieldTone = "light" | "dark";

/* ------------------------------------------------------------------ */
/* Field wrapper                                                        */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: FieldTone;
  /** Marks the control required (adds the asterisk, hidden from readers). */
  required?: boolean;
}

export function Field({ label, hint, error, htmlFor, className, children, trailing, tone = "light", required }: FieldProps) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(label || trailing) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className={cn("text-[13px] font-semibold leading-none", dark ? "text-white/85" : "text-ink")}>
              {label}
              {required && (
                <span aria-hidden className={cn("ml-0.5", dark ? "text-brand-300" : "text-brand-700")}>
                  *
                </span>
              )}
            </label>
          )}
          {trailing}
        </div>
      )}
      {children}
      {error ? (
        <p className={cn("text-xs font-medium leading-snug", dark ? "text-[#ff8a8c]" : "text-danger")} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={cn("text-xs leading-snug", dark ? "text-white/55" : "text-muted")}>{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input                                                                */
/* ------------------------------------------------------------------ */

/** Base classes for a light field; kept exported for custom controls. */
export const inputBase =
  "w-full rounded-field bg-surface-2 px-4 text-[15px] text-ink placeholder:text-muted outline-none " +
  "transition-[box-shadow,background-color] duration-200 ease-out " +
  "focus:bg-white focus:ring-2 focus:ring-ink " +
  "disabled:cursor-not-allowed disabled:text-muted " +
  "aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger";

/** Dark fields for charcoal cards. */
export const inputDark =
  "w-full rounded-field bg-white/[0.07] px-4 text-[15px] text-white placeholder:text-white/50 outline-none " +
  "ring-1 ring-inset ring-white/10 transition-[box-shadow,background-color] duration-200 ease-out " +
  "focus:bg-white/10 focus:ring-2 focus:ring-brand-400 " +
  "disabled:cursor-not-allowed disabled:text-white/40 " +
  "aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#ff8a8c]";

export function inputClass(tone: FieldTone = "light") {
  return tone === "dark" ? inputDark : inputBase;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerClassName?: string;
  trailing?: React.ReactNode;
  tone?: FieldTone;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, className, containerClassName, id, type, trailing, tone = "light", required, ...props },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const [show, setShow] = React.useState(false);
  const isPassword = type === "password";
  const dark = tone === "dark";
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={containerClassName} trailing={trailing} tone={tone} required={required}>
      <div className="relative">
        {leftIcon && (
          <span className={cn("pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 [&_svg]:h-[18px] [&_svg]:w-[18px]", dark ? "text-white/60" : "text-muted")}>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={isPassword ? (show ? "text" : "password") : type}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          aria-required={required || undefined}
          required={required}
          className={cn(inputClass(tone), "h-14", leftIcon && "pl-12", (rightSlot || isPassword) && "pr-12", className)}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className={cn("absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition-colors", dark ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-surface-3 hover:text-ink")}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : (
          rightSlot && <span className={cn("absolute right-4 top-1/2 -translate-y-1/2", dark ? "text-white/60" : "text-muted")}>{rightSlot}</span>
        )}
      </div>
      {error && <span id={errorId} className="sr-only">{error}</span>}
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* Textarea                                                             */
/* ------------------------------------------------------------------ */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  tone?: FieldTone;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, className, id, tone = "light", required, ...props }, ref) {
  const autoId = React.useId();
  const taId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={taId} tone={tone} required={required}>
      <textarea ref={ref} id={taId} aria-invalid={!!error} required={required} className={cn(inputClass(tone), "min-h-28 resize-none py-4", className)} {...props} />
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* Select                                                               */
/* ------------------------------------------------------------------ */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  tone?: FieldTone;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, options, placeholder, className, id, tone = "light", required, ...props }, ref) {
  const autoId = React.useId();
  const selId = id ?? autoId;
  const dark = tone === "dark";
  return (
    <Field label={label} hint={hint} error={error} htmlFor={selId} tone={tone} required={required}>
      <div className="relative">
        <select ref={ref} id={selId} aria-invalid={!!error} required={required} className={cn(inputClass(tone), "h-14 appearance-none pr-12", dark && "[&_option]:text-ink", className)} {...props}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg className={cn("pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2", dark ? "text-white/60" : "text-muted")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* OTP / PIN input                                                      */
/* ------------------------------------------------------------------ */

export function OtpInput({ length = 6, value, onChange, error, autoFocus, label, tone = "light" }: { length?: number; value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean; label?: string; tone?: FieldTone }) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const setAt = (i: number, ch: string) => {
    const next = digits.slice();
    next[i] = ch;
    onChange(next.join("").slice(0, length));
  };
  return (
    <Field label={label} error={error} tone={tone}>
      <div
        className="flex justify-between gap-2"
        onPaste={(e) => {
          const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
          if (text) {
            e.preventDefault();
            onChange(text);
            refs.current[Math.min(text.length, length - 1)]?.focus();
          }
        }}
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoFocus={autoFocus && i === 0}
            value={d}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={!!error}
            onChange={(e) => {
              const ch = e.target.value.replace(/\D/g, "").slice(-1);
              setAt(i, ch);
              if (ch && i < length - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
                setAt(i - 1, "");
              }
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
            }}
            className={cn(inputClass(tone), "h-14 w-full min-w-0 px-0 text-center text-xl font-semibold tabular-nums tracking-widest")}
          />
        ))}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle: yellow when on                                               */
/* ------------------------------------------------------------------ */

export function Toggle({ checked, onChange, label, description, disabled, tone = "brand", size = "md", className }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean; tone?: "brand" | "driver" | "ink"; size?: "md" | "lg"; className?: string }) {
  const on = tone === "driver" ? "bg-driver-500" : tone === "ink" ? "bg-ink" : "bg-brand-400";
  const check = tone === "driver" ? "text-driver-600" : "text-ink";
  const lg = size === "lg";
  return (
    <label className={cn("flex items-center justify-between gap-4", disabled && "opacity-50", className)}>
      {(label || description) && (
        <span className="flex min-w-0 flex-col gap-0.5">
          {label && <span className={cn("font-semibold leading-snug", lg ? "text-[17px]" : "text-sm")}>{label}</span>}
          {description && <span className="text-[13px] leading-snug text-muted text-pretty">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative shrink-0 rounded-full p-1 transition-colors duration-200 ease-out",
          lg ? "h-9 w-[60px]" : "h-7 w-12",
          checked ? on : "bg-[#d4d4d0]",
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(17,17,17,0.25)] transition-transform duration-300 ease-(--ease-spring)",
            lg ? "h-7 w-7" : "h-5 w-5",
            checked ? (lg ? "translate-x-6" : "translate-x-5") : "translate-x-0",
          )}
        >
          <Check size={lg ? 16 : 12} strokeWidth={3} className={cn("transition-opacity duration-150", check, checked ? "opacity-100" : "opacity-0")} aria-hidden />
        </span>
      </button>
    </label>
  );
}
