"use client";

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  disabled?: boolean;
  error?: string | null;
  autoFocus?: boolean;
  className?: string;
}

export function PinInput({
  length = 6,
  onComplete,
  disabled = false,
  error = null,
  autoFocus = true,
  className = "",
}: PinInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Check if PIN is complete
  useEffect(() => {
    const pin = digits.join("");
    if (pin.length === length && !disabled) {
      onComplete(pin);
    }
  }, [digits, length, onComplete, disabled]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const sanitized = value.replace(/\D/g, "");
    if (!sanitized) return;

    // Take only the last character if multiple are pasted
    const digit = sanitized.slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // Move to next input
    if (index < length - 1 && digit) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      
      if (digits[index]) {
        // Clear current digit
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      } else if (index > 0) {
        // Move to previous input and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
        setFocusedIndex(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    } else if (e.key === "Enter") {
      const pin = digits.join("");
      if (pin.length === length) {
        onComplete(pin);
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const sanitized = pastedData.replace(/\D/g, "").slice(0, length);

    if (sanitized) {
      const newDigits = sanitized.split("");
      while (newDigits.length < length) {
        newDigits.push("");
      }
      setDigits(newDigits);

      // Focus last filled input or last input
      const nextIndex = Math.min(sanitized.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      setFocusedIndex(nextIndex);
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    // Select all text in input for easy replacement
    inputRefs.current[index]?.select();
  };

  const clearPin = () => {
    setDigits(Array(length).fill(""));
    inputRefs.current[0]?.focus();
    setFocusedIndex(0);
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* PIN Input Boxes */}
      <div className="flex gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={() => handleFocus(index)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`
              w-12 h-14 sm:w-14 sm:h-16 
              text-2xl sm:text-3xl font-bold text-center
              border-2 rounded-lg
              transition-all duration-200
              ${
                error
                  ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                  : focusedIndex === index
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : digit
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400"}
              focus:outline-none focus:ring-2 focus:ring-blue-500/50
            `}
            aria-label={`PIN digit ${index + 1}`}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* Clear Button */}
      {digits.some((d) => d !== "") && !disabled && (
        <button
          type="button"
          onClick={clearPin}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// Compact PIN Display (for showing session code to others)
export function PinDisplay({ pin, className = "" }: { pin: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy PIN:", err);
    }
  };

  const digits = pin.split("");

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="flex gap-2">
        {digits.map((digit, index) => (
          <div
            key={index}
            className="
              w-12 h-14 sm:w-14 sm:h-16
              flex items-center justify-center
              text-3xl sm:text-4xl font-bold
              border-2 border-blue-500 rounded-lg
              bg-blue-50 dark:bg-blue-900/30
              text-blue-700 dark:text-blue-300
            "
          >
            {digit}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="
          px-4 py-2 text-sm
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          border border-gray-300 dark:border-gray-600
          rounded-lg
          transition-colors
          flex items-center gap-2
        "
      >
        {copied ? (
          <>
            <span>✓</span>
            <span>Copied!</span>
          </>
        ) : (
          <>
            <span>📋</span>
            <span>Copy Code</span>
          </>
        )}
      </button>
    </div>
  );
}

