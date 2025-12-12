"use client";

import { useState } from "react";
import type { SessionQuestion } from "@/types/session";

interface WordCloudQuestionProps {
  question: SessionQuestion;
  onAnswer: (words: string) => void;
  disabled?: boolean;
  submittedAnswer?: string | null;
  className?: string;
}

export function WordCloudQuestion({
  question,
  onAnswer,
  disabled = false,
  submittedAnswer = null,
  className = "",
}: WordCloudQuestionProps) {
  const [answer, setAnswer] = useState(submittedAnswer || "");
  const [tags, setTags] = useState<string[]>(
    submittedAnswer ? submittedAnswer.split(",").map((t) => t.trim()) : []
  );

  const handleAddTag = () => {
    const trimmed = answer.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setAnswer("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!disabled) {
      setTags(tags.filter((tag) => tag !== tagToRemove));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = () => {
    if (tags.length > 0 && !disabled) {
      onAnswer(tags.join(", "));
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Question Text */}
      <div className="text-xl font-semibold text-center text-gray-900 dark:text-gray-100">
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

      {/* Info Banner */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-3">
          <span className="text-2xl">☁️</span>
          <div className="flex-1">
            <div className="font-semibold text-purple-700 dark:text-purple-300">
              Word Cloud Question
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-400">
              Enter words or short phrases that come to mind. There&apos;s no right
              or wrong answer! Your responses will appear in a collaborative word
              cloud.
            </div>
          </div>
        </div>
      </div>

      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {tags.map((tag, index) => (
            <div
              key={index}
              className="
                inline-flex items-center gap-2
                px-3 py-1.5
                bg-purple-100 dark:bg-purple-900/30
                text-purple-700 dark:text-purple-300
                rounded-full
                border border-purple-300 dark:border-purple-700
              "
            >
              <span className="font-medium">{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-purple-900 dark:hover:text-purple-100"
                  aria-label={`Remove ${tag}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input Field */}
      {!disabled && (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="word-input"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Add words or phrases:
          </label>
          <div className="flex gap-2">
            <input
              id="word-input"
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a word and press Enter..."
              maxLength={50}
              className="
                flex-1 px-4 py-3
                border-2 border-gray-300 dark:border-gray-600
                rounded-lg
                text-lg
                focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50
                transition-colors
                placeholder:text-gray-400
              "
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!answer.trim()}
              className="
                px-6 py-3
                bg-purple-600 hover:bg-purple-700
                disabled:bg-gray-300 dark:disabled:bg-gray-700
                text-white font-semibold
                rounded-lg
                transition-colors
                disabled:cursor-not-allowed
              "
            >
              Add
            </button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Press Enter or click Add to include this word • {tags.length} word
            {tags.length !== 1 ? "s" : ""} added
          </div>
        </div>
      )}

      {/* Submit Button */}
      {!disabled && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={tags.length === 0}
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
          Submit Words ({tags.length})
        </button>
      )}

      {/* Submitted State */}
      {disabled && submittedAnswer && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <span className="text-2xl">✓</span>
            <span className="font-semibold">
              Your words have been submitted!
            </span>
          </div>
          <div className="text-sm text-green-600 dark:text-green-400 mt-1">
            They&apos;ll appear in the word cloud once the teacher shows the
            results.
          </div>
        </div>
      )}

      {/* Hint */}
      {question.hintText && !disabled && (
        <details className="text-sm">
          <summary className="cursor-pointer text-purple-600 dark:text-purple-400 hover:underline">
            💡 Need inspiration?
          </summary>
          <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
            {question.hintText}
          </div>
        </details>
      )}
    </div>
  );
}

