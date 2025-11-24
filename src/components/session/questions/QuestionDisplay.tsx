"use client";

import type { SessionQuestion, QuestionType } from "@/types/session";
import { MultipleChoiceQuestion } from "./MultipleChoiceQuestion";
import { TrueFalseQuestion } from "./TrueFalseQuestion";
import { ShortAnswerQuestion } from "./ShortAnswerQuestion";
import { WordCloudQuestion } from "./WordCloudQuestion";
import { PinOnMapQuestion } from "./PinOnMapQuestion";

interface QuestionDisplayProps {
  question: SessionQuestion;
  onSubmitAnswer: (answer: {
    optionId?: string;
    textAnswer?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  disabled?: boolean;
  submittedAnswer?: {
    optionId?: string | null;
    textAnswer?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  showCorrect?: boolean;
  className?: string;
}

export function QuestionDisplay({
  question,
  onSubmitAnswer,
  disabled = false,
  submittedAnswer = null,
  showCorrect = false,
  className = "",
}: QuestionDisplayProps) {
  const questionType = question.questionType as QuestionType;

  // Route to appropriate question component based on type
  switch (questionType) {
    case "MultipleChoice":
      return (
        <MultipleChoiceQuestion
          question={question}
          onAnswer={(optionId) => onSubmitAnswer({ optionId })}
          disabled={disabled}
          selectedOptionId={submittedAnswer?.optionId}
          showCorrect={showCorrect}
          className={className}
        />
      );

    case "TrueFalse":
      return (
        <TrueFalseQuestion
          question={question}
          onAnswer={(optionId) => onSubmitAnswer({ optionId })}
          disabled={disabled}
          selectedOptionId={submittedAnswer?.optionId}
          showCorrect={showCorrect}
          className={className}
        />
      );

    case "ShortAnswer":
      return (
        <ShortAnswerQuestion
          question={question}
          onAnswer={(textAnswer) => onSubmitAnswer({ textAnswer })}
          disabled={disabled}
          submittedAnswer={submittedAnswer?.textAnswer}
          showCorrect={showCorrect}
          className={className}
        />
      );

    case "WordCloud":
      return (
        <WordCloudQuestion
          question={question}
          onAnswer={(textAnswer) => onSubmitAnswer({ textAnswer })}
          disabled={disabled}
          submittedAnswer={submittedAnswer?.textAnswer}
          className={className}
        />
      );

    case "PinOnMap":
      return (
        <PinOnMapQuestion
          question={question}
          onAnswer={(latitude, longitude) =>
            onSubmitAnswer({ latitude, longitude })
          }
          disabled={disabled}
          submittedLatitude={submittedAnswer?.latitude}
          submittedLongitude={submittedAnswer?.longitude}
          showCorrect={showCorrect}
          className={className}
        />
      );

    default:
      return (
        <div className="p-8 text-center">
          <div className="text-red-600 dark:text-red-400 mb-2">
            ⚠️ Unknown Question Type
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            Question type &quot;{questionType}&quot; is not supported.
          </div>
        </div>
      );
  }
}

// Question type indicator badge
export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const config = {
    MultipleChoice: {
      icon: "☑️",
      label: "Multiple Choice",
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    },
    TrueFalse: {
      icon: "✓✗",
      label: "True/False",
      color:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
    ShortAnswer: {
      icon: "✍️",
      label: "Short Answer",
      color:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    },
    WordCloud: {
      icon: "☁️",
      label: "Word Cloud",
      color:
        "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    },
    PinOnMap: {
      icon: "📍",
      label: "Pin on Map",
      color:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    },
  };

  const { icon, label, color } = config[type] || {
    icon: "❓",
    label: type,
    color: "bg-gray-100 text-gray-700",
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${color}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

