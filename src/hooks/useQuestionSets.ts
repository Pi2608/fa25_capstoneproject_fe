import { useState, useMemo, useEffect } from "react";
import { QuestionDto, QuestionOptionDto } from "@/lib/api-ques";

export type QuestionType =
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE"
    | "SHORT_ANSWER"
    | "PIN_ON_MAP";

export type QuestionOptionInput = {
    id: string;
    optionText: string;
    isCorrect: boolean;
    optionImageUrl?: string | null;
    displayOrder: number;
};

export type Question = {
    id: string;
    remoteId?: string;
    text: string;
    questionType: QuestionType;
    answer: string;
    trueFalseAnswer: "TRUE" | "FALSE";
    options: QuestionOptionInput[];
    correctLatitude: string;
    correctLongitude: string;
    acceptanceRadiusMeters: string;
    questionImageUrl: string;
    questionAudioUrl: string;
    hintText: string;
    explanation: string;
};

export const QUESTION_TYPES: QuestionType[] = [
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
    "SHORT_ANSWER",
    "PIN_ON_MAP",
];

const DEFAULT_OPTION_COUNT = 4;

function generateId(prefix: string) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyOption(displayOrder: number): QuestionOptionInput {
    return {
        id: generateId("opt"),
        optionText: "",
        isCorrect: false,
        optionImageUrl: "",
        displayOrder,
    };
}

function createQuestionTemplate(index = 1): Question {
    return {
        id: `q-${index}`,
        text: "",
        questionType: "MULTIPLE_CHOICE",
        answer: "",
        trueFalseAnswer: "TRUE",
        options: Array.from({ length: DEFAULT_OPTION_COUNT }).map((_, idx) =>
            createEmptyOption(idx + 1)
        ),
        correctLatitude: "",
        correctLongitude: "",
        acceptanceRadiusMeters: "",
        questionImageUrl: "",
        questionAudioUrl: "",
        hintText: "",
        explanation: "",
    };
}

function createInitialQuestions(count: number = 5): Question[] {
    return Array.from({ length: count }).map((_, idx) =>
        createQuestionTemplate(idx + 1)
    );
}

function mapOptions(options?: QuestionOptionDto[]): QuestionOptionInput[] {
    if (!options || options.length === 0) {
        return Array.from({ length: DEFAULT_OPTION_COUNT }).map((_, idx) =>
            createEmptyOption(idx + 1)
        );
    }

    return options
        .slice()
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map(opt => ({
            id: opt.questionOptionId ?? generateId("opt"),
            optionText: opt.optionText ?? "",
            isCorrect: Boolean(opt.isCorrect),
            optionImageUrl: opt.optionImageUrl ?? "",
            displayOrder: opt.displayOrder ?? 0,
        }));
}

function questionsFromApi(apiQuestions: QuestionDto[]): Question[] {
    if (!apiQuestions || apiQuestions.length === 0) {
        return createInitialQuestions();
    }

    const sorted = [...apiQuestions].sort((a, b) => {
        const ao = typeof a.displayOrder === "number" ? a.displayOrder : 0;
        const bo = typeof b.displayOrder === "number" ? b.displayOrder : 0;
        return ao - bo;
    });

    return sorted.map((q, idx) => {
        const type = (QUESTION_TYPES.includes(q.questionType as QuestionType)
            ? q.questionType
            : "MULTIPLE_CHOICE") as QuestionType;

        const mappedOptions = mapOptions(q.options);
        const trueFalseAnswer =
            mappedOptions.find(opt => opt.isCorrect)?.optionText?.toUpperCase() === "FALSE"
                ? "FALSE"
                : "TRUE";

        return {
            id: `q-${idx + 1}`,
            remoteId: q.questionId,
            text: q.questionText ?? "",
            questionType: type,
            answer: q.correctAnswerText ?? "",
            trueFalseAnswer,
            options: mappedOptions,
            correctLatitude: q.correctLatitude != null ? String(q.correctLatitude) : "",
            correctLongitude: q.correctLongitude != null ? String(q.correctLongitude) : "",
            acceptanceRadiusMeters:
                q.acceptanceRadiusMeters != null ? String(q.acceptanceRadiusMeters) : "",
            questionImageUrl: q.questionImageUrl ?? "",
            questionAudioUrl: q.questionAudioUrl ?? "",
            hintText: q.hintText ?? "",
            explanation: q.explanation ?? "",
        };
    });
}

export function useQuestionSets(initialQuestions: QuestionDto[] = []) {
    const [questions, setQuestions] = useState<Question[]>(() =>
        createInitialQuestions()
    );

    useEffect(() => {
        if (initialQuestions.length > 0) {
            setQuestions(questionsFromApi(initialQuestions));
        } else {
            setQuestions(createInitialQuestions());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(initialQuestions)]);

    const handleChangeQuestion = <K extends keyof Question>(
        index: number,
        field: K,
        value: Question[K]
    ) => {
        setQuestions(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddQuestion = () => {
        setQuestions(prev => {
            const newIndex = prev.length + 1;
            return [...prev, createQuestionTemplate(newIndex)];
        });
    };

    const handleRemoveQuestion = (index: number) => {
        setQuestions(prev => {
            if (prev.length <= 1) return prev;
            return prev.filter((_, i) => i !== index);
        });
    };

    const overview = useMemo(() => {
        const filled = questions.filter(q => {
            if (!q.text.trim()) return false;
            switch (q.questionType) {
                case "MULTIPLE_CHOICE":
                    return q.options.some(opt => opt.optionText.trim());
                case "TRUE_FALSE":
                    return true;
                case "SHORT_ANSWER":
                    return q.answer.trim().length > 0;
                case "PIN_ON_MAP":
                    return (
                        q.correctLatitude.trim().length > 0 &&
                        q.correctLongitude.trim().length > 0 &&
                        q.acceptanceRadiusMeters.trim().length > 0
                    );
                default:
                    return false;
            }
        }).length;

        return { total: questions.length, filled };
    }, [questions]);

    return {
        questions,
        setQuestions,
        handleChangeQuestion,
        handleAddQuestion,
        handleRemoveQuestion,
        overview,
        questionsFromApi,
    };
}

