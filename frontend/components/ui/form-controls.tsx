import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type BaseFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
};

function FieldWrapper({
  id,
  label,
  required,
  helpText,
  error,
  children,
}: BaseFieldProps & { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </label>
      {children}
      {helpText ? <p className="text-xs text-slate-500">{helpText}</p> : null}
      {error ? <p className="text-xs font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  required,
  helpText,
  error,
  className = "",
  ...props
}: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldWrapper id={id} label={label} required={required} helpText={helpText} error={error}>
      <input
        id={id}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${className}`}
        {...props}
      />
    </FieldWrapper>
  );
}

export function SelectField({
  id,
  label,
  required,
  helpText,
  error,
  className = "",
  children,
  ...props
}: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldWrapper id={id} label={label} required={required} helpText={helpText} error={error}>
      <select
        id={id}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

export function TextareaField({
  id,
  label,
  required,
  helpText,
  error,
  className = "",
  ...props
}: BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldWrapper id={id} label={label} required={required} helpText={helpText} error={error}>
      <textarea
        id={id}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${className}`}
        {...props}
      />
    </FieldWrapper>
  );
}

export function Button({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
