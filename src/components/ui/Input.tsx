import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';

const baseField =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(baseField, className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(baseField, 'min-h-20 resize-y', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(baseField, 'cursor-pointer', className)} {...props}>
        {children}
      </select>
    );
  },
);

/**
 * Password field with a reveal toggle.
 *
 * Typing a password you cannot see is the main cause of failed logins, and it
 * is worse here than usual: signup enforces 8+ characters and the confirm
 * fields reject a silent typo only after submit.
 *
 * `type` is deliberately not accepted — this component owns it. Everything else
 * (autoComplete, value, onChange, required) passes straight through, so
 * password managers behave exactly as they do on a plain input.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function PasswordInput({ className, disabled, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        // Room for the button so a long password never runs underneath it.
        className={cn(baseField, 'pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        className={cn(
          'absolute right-0 top-0 grid h-full w-10 place-items-center rounded-r-lg text-muted',
          'transition-colors hover:text-text focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50',
          'disabled:pointer-events-none disabled:opacity-60',
        )}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
        {required && <span className="ml-0.5 text-loss">*</span>}
      </label>
      {children}
      {error ? (
        <span className="text-xs text-loss">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </div>
  );
}
