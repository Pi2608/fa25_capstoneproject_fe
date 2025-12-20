import { QuestionBankDto } from "@/lib/api-session";

// ============ TYPES ============
export type QuestionBankFormState = {
    bankName: string;
    description: string;
    category: string;
    tags: string;
    isTemplate: boolean;
    isPublic: boolean;
};

export type TabKey = "my" | "public";
export type MapOption = { id: string; name: string };
export type BankExtra = { totalQuestions: number; tags: string[] };
export type RowMenuState = { id: string; bank: QuestionBankDto; top: number; left: number };

// ============ UTILS ============
export const safeMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === "string") return m;
    }
    return fallback;
};

export const normalizeTags = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "string") return value.split(",").map(s => s.trim()).filter(Boolean);
    return [];
};

export const labelFromCount = (count: number): string =>
    count === 0 ? "Chưa có" : count === 1 ? "1 câu" : `${count} câu`;

export const resolveBankId = (bank: QuestionBankDto | null): string => bank?.questionBankId ?? "";

export const mapWorkspaceMapsToOptions = (rawMaps: unknown): MapOption[] => {
    if (!Array.isArray(rawMaps)) return [];
    return rawMaps
        .map(item => {
            const id = (item as any).mapId ?? (item as any).id ?? "";
            if (!id) return null;
            const name = (item as any).mapName ?? (item as any).name ?? (item as any).title ?? id;
            return { id: String(id), name: String(name) };
        })
        .filter((opt): opt is MapOption => Boolean(opt?.id));
};
