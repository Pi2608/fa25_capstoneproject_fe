"use client";

import { useState } from "react";
import type { SessionQuestion } from "@/types/session";

interface ShortAnswerQuestionProps {
  question: SessionQuestion;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  submittedAnswer?: string | null;
  showCorrect?: boolean;
  className?: string;
}

export function ShortAnswerQuestion({
  question,
  onAnswer,
  disabled = false,
  submittedAnswer = null,
  showCorrect = false,
  className = "",
}: ShortAnswerQuestionProps) {
  const [answer, setAnswer] = useState(submittedAnswer || "");

  const handleSubmit = () => {
    if (answer.trim() && !disabled) {
      onAnswer(answer.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
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

      {/* Answer Input */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="answer-input"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Your Answer:
        </label>
        <textarea
          id="answer-input"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
          placeholder="Type your answer here..."
          rows={4}
          className={`
            w-full px-4 py-3
            border-2 rounded-lg
            text-lg
            transition-colors
            ${
              disabled
                ? "border-gray-300 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            }
            ${showCorrect && submittedAnswer ? "bg-blue-50 dark:bg-blue-900/20" : ""}
            placeholder:text-gray-400
            resize-none
          `}
        />
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {answer.length} / 500 characters
          {!disabled && " • Press Enter to submit"}
        </div>
      </div>

      {/* Submit Button */}
      {!showCorrect && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!answer.trim() || disabled}
          className="
            px-8 py-3
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

      {/* Show Correct Answer (after submission) */}
      {showCorrect && question.correctAnswerText && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="font-semibold text-green-700 dark:text-green-300 mb-1">
            ✓ Correct Answer:
          </div>
          <div className="text-green-600 dark:text-green-400 text-lg">
            {question.correctAnswerText}
          </div>
        </div>
      )}

      {/* Your Submitted Answer */}
      {showCorrect && submittedAnswer && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="font-semibold text-blue-700 dark:text-blue-300 mb-1">
            Your Answer:
          </div>
          <div className="text-blue-600 dark:text-blue-400 text-lg">
            {submittedAnswer}
          </div>
        </div>
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

      {/* Explanation */}
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

