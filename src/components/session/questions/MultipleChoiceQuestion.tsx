"use client";

import { useState } from "react";
import type { SessionQuestion, QuestionOption } from "@/types/session";

interface MultipleChoiceQuestionProps {
  question: SessionQuestion;
  onAnswer: (optionId: string) => void;
  disabled?: boolean;
  selectedOptionId?: string | null;
  showCorrect?: boolean;
  className?: string;
}

export function MultipleChoiceQuestion({
  question,
  onAnswer,
  disabled = false,
  selectedOptionId = null,
  showCorrect = false,
  className = "",
}: MultipleChoiceQuestionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedOptionId);

  const handleSelect = (optionId: string) => {
    if (disabled) return;
    setSelectedId(optionId);
  };

  const handleSubmit = () => {
    if (selectedId && !disabled) {
      onAnswer(selectedId);
    }
  };

  const sortedOptions = [...(question.options || [])].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const getOptionStyle = (option: QuestionOption) => {
    const isSelected = option.id === selectedId;
    const isCorrect = showCorrect && option.isCorrect;
    const isWrong = showCorrect && isSelected && !option.isCorrect;

    if (isCorrect) {
      return "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
    }
    if (isWrong) {
      return "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
    }
    if (isSelected) {
      return "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md";
    }
    return "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800";
  };

  const getOptionIcon = (option: QuestionOption) => {
    const isSelected = option.id === selectedId;
    const isCorrect = showCorrect && option.isCorrect;
    const isWrong = showCorrect && isSelected && !option.isCorrect;

    if (isCorrect) return "✓";
    if (isWrong) return "✗";
    if (isSelected) return "●";
    return "○";
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Question Text */}
      <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
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

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => handleSelect(option.id)}
            disabled={disabled}
            className={`
              flex items-start gap-3 p-4
              border-2 rounded-lg
              text-left transition-all duration-200
              ${getOptionStyle(option)}
              ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}
            `}
          >
            {/* Option Icon/Checkbox */}
            <div className="flex-shrink-0 text-2xl mt-0.5">
              {getOptionIcon(option)}
            </div>

            {/* Option Content */}
            <div className="flex-1 min-w-0">
              <div className="font-medium">{option.optionText}</div>
              {option.optionImageUrl && (
                <img
                  src={option.optionImageUrl}
                  alt={`Option ${option.optionText}`}
                  className="mt-2 w-full max-w-xs rounded"
                />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Submit Button */}
      {!showCorrect && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedId || disabled}
          className="
            px-8 py-3 mt-2
            bg-blue-600 hover:bg-blue-700
            disabled:bg-gray-300 dark:disabled:bg-gray-700
            text-white font-semibold text-lg
            rounded-lg
            transition-colors
            disabled:cursor-not-allowed
          "
        >
          {disabled ? "Submitted" : "Submit Answer"}
        </button>
      )}

      {/* Hint */}
      {question.hintText && !showCorrect && (
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
            💡 Need a hint?
          </summary>
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            {question.hintText}
          </div>
        </details>
      )}

      {/* Explanation (shown after submission) */}
      {showCorrect && question.explanation && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
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

