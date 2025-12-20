import { useState, ChangeEvent } from "react";
import { QuestionBankDto } from "@/lib/api-session";
import { Workspace } from "@/types/workspace";
import { QuestionBankFormState, normalizeTags } from "./question-bank-common";

const INITIAL_FORM: QuestionBankFormState = {
    bankName: "",
    description: "",
    category: "",
    tags: "",
    isTemplate: false,
    isPublic: false,
};

export function useBankForm(workspaces: Workspace[]) {
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(INITIAL_FORM);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
    const [editingBank, setEditingBank] = useState<QuestionBankDto | null>(null);

    const isEditMode = Boolean(editingBank);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const target = e.target as HTMLInputElement;
        const value = target.type === "checkbox" ? target.checked : target.value;
        setForm(prev => ({ ...prev, [target.name]: value }));
    };

    const openCreate = () => {
        setForm(INITIAL_FORM);
        setEditingBank(null);
        setSelectedWorkspaceId(workspaces[0]?.workspaceId ?? "");
        setIsOpen(true);
    };

    const openEdit = (bank: QuestionBankDto) => {
        setEditingBank(bank);
        setForm({
            bankName: bank.bankName ?? "",
            description: bank.description ?? "",
            category: bank.category ?? "",
            tags: normalizeTags(bank.tags).join(", "),
            isTemplate: Boolean(bank.isTemplate),
            isPublic: Boolean(bank.isPublic),
        });
        setSelectedWorkspaceId(bank.workspaceId ?? "");
        setIsOpen(true);
    };

    const close = () => {
        if (!saving) {
            setIsOpen(false);
            setForm(INITIAL_FORM);
            setSelectedWorkspaceId("");
            setEditingBank(null);
        }
    };

    return {
        isOpen, saving, setSaving, form, selectedWorkspaceId, setSelectedWorkspaceId,
        editingBank, isEditMode, handleChange, openCreate, openEdit, close,
    };
}
