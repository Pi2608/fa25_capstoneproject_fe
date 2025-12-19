import { useState, useEffect } from "react";
import { QuestionBankDto } from "@/lib/api-session";
import { RowMenuState, resolveBankId } from "./question-bank-common";

export function useRowMenu() {
    const [state, setState] = useState<RowMenuState | null>(null);

    const toggle = (bank: QuestionBankDto, button: HTMLButtonElement) => {
        const rowId = resolveBankId(bank);
        if (!rowId) return;
        setState(prev => {
            if (prev?.id === rowId) return null;
            const rect = button.getBoundingClientRect();
            const width = 208, padding = 16;
            return {
                id: rowId,
                bank,
                top: rect.bottom + 8,
                left: Math.max(padding, Math.min(rect.right - width, window.innerWidth - width - padding)),
            };
        });
    };

    const close = () => setState(null);

    useEffect(() => {
        if (!state) return;
        const dismiss = () => setState(null);
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
        window.addEventListener("scroll", dismiss, true);
        window.addEventListener("resize", dismiss);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("scroll", dismiss, true);
            window.removeEventListener("resize", dismiss);
            window.removeEventListener("keydown", onKey);
        };
    }, [state]);

    return { state, toggle, close };
}
