"use client";

import { useState } from "react";
import type { SessionQuestion } from "@/types/session";

interface TrueFalseQuestionProps {
  question: SessionQuestion;
  onAnswer: (optionId: string) => void;
  disabled?: boolean;
  selectedOptionId?: string | null;
  showCorrect?: boolean;
  className?: string;
}

export function TrueFalseQuestion({
  question,
  onAnswer,
  disabled = false,
  selectedOptionId = null,
  showCorrect = false,
  className = "",
}: TrueFalseQuestionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedOptionId);

  const trueOption = question.options?.find((opt) =>
    opt.optionText.toLowerCase().includes("true")
  );
  const falseOption = question.options?.find((opt) =>
    opt.optionText.toLowerCase().includes("false")
  );

  const handleSelect = (optionId: string) => {
    if (disabled) return;
    setSelectedId(optionId);
    // Auto-submit for True/False
    onAnswer(optionId);
  };

  const getButtonStyle = (optionId: string, isCorrect?: boolean) => {
    const isSelected = optionId === selectedId;

    if (showCorrect && isCorrect) {
      return "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 shadow-lg";
    }
    if (showCorrect && isSelected && !isCorrect) {
      return "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
    }
    if (isSelected) {
      return "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md scale-105";
    }
    return "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-105";
  };

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      {/* Question Text */}
      <div className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 max-w-3xl">
        {question.questionText}
      </div>

      {/* Question Image */}
      {question.questionImageUrl && (
        <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden">
          <img
            src={question.questionImageUrl}
            alt="Question"
            className="w-full h-auto"
          />
        </div>
      )}

      {/* True/False Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
        {/* True Button */}
        {trueOption && (
          <button
            type="button"
            onClick={() => handleSelect(trueOption.id)}
            disabled={disabled}
            className={`
              flex-1 flex flex-col items-center justify-center
              px-8 py-12 sm:py-16
              border-4 rounded-2xl
              transition-all duration-300
              ${getButtonStyle(trueOption.id, trueOption.isCorrect)}
              ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}
            `}
          >
            <div className="text-6xl sm:text-7xl mb-4">✓</div>
            <div className="text-2xl sm:text-3xl font-bold">TRUE</div>
            {showCorrect && trueOption.isCorrect && (
              <div className="text-sm mt-2 text-green-600 dark:text-green-400">
                ✓ Correct
              </div>
            )}
          </button>
        )}

        {/* False Button */}
        {falseOption && (
          <button
            type="button"
            onClick={() => handleSelect(falseOption.id)}
            disabled={disabled}
            className={`
              flex-1 flex flex-col items-center justify-center
              px-8 py-12 sm:py-16
              border-4 rounded-2xl
              transition-all duration-300
              ${getButtonStyle(falseOption.id, falseOption.isCorrect)}
              ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}
            `}
          >
            <div className="text-6xl sm:text-7xl mb-4">✗</div>
            <div className="text-2xl sm:text-3xl font-bold">FALSE</div>
            {showCorrect && falseOption.isCorrect && (
              <div className="text-sm mt-2 text-green-600 dark:text-green-400">
                ✓ Correct
              </div>
            )}
          </button>
        )}
      </div>

      {/* Hint */}
      {question.hintText && !showCorrect && (
        <details className="text-sm w-full max-w-2xl">
          <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline text-center">
            💡 Need a hint?
          </summary>
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            {question.hintText}
          </div>
        </details>
      )}

      {/* Explanation */}
      {showCorrect && question.explanation && (
        <div className="w-full max-w-2xl p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
          <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
            📖 Explanation:
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            {question.explanation}
          </div>
        </div>
      )}
    </div>
  );
}

