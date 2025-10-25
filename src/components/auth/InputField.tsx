"use client";

import { InputFieldProps } from "@/types/auth";

export default function InputField({
  type = "text",
  value,
  onChange,
  placeholder,
  label,
  required = false,
  className = "",
  inputClassName = ""
}: InputFieldProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors bg-white dark:bg-gray-800 ${inputClassName}`}
        required={required}
      />
    </div>
  );
}
