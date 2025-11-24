import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { getWorkspaceById } from "@/lib/api-workspaces";
import {
    getOrganizationById,
    OrganizationDetailDto,
} from "@/lib/api-organizations";
import { Workspace } from "@/types/workspace";
import {
    getQuestionBank,
    getQuestionsOfQuestionBank,
    QuestionBankDto,
    QuestionDto,
} from "@/lib/api-ques";
import { getMapDetail } from "@/lib/api-maps";

function safeMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === "string") return m;
    }
    return fallback;
}

export function useQuestionBankData(orgId: string, bankId: string) {
    const { t } = useI18n();
    const [org, setOrg] = useState<OrganizationDetailDto | null>(null);
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [questionBank, setQuestionBank] = useState<(QuestionBankDto & { questions: QuestionDto[] }) | null>(null);
    const [mapName, setMapName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const loadAll = useCallback(async () => {
        if (!orgId || !bankId) {
            setErr("Thiếu thông tin bộ câu hỏi. Vui lòng quay lại workspace.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setErr(null);

            const bankRes = await getQuestionBank(bankId);
            const bankWorkspaceId = bankRes.workspaceId ?? null;

            const [orgRes, questionsRes] = await Promise.all([
                getOrganizationById(orgId),
                getQuestionsOfQuestionBank(bankId),
            ]);

            let workspaceRes: Workspace | null = null;
            if (bankWorkspaceId) {
                workspaceRes = await getWorkspaceById(bankWorkspaceId);
            }

            setOrg(orgRes.organization);
            setWorkspace(workspaceRes);
            setQuestionBank({ ...bankRes, questions: questionsRes });

            const mapId = bankRes.mapId ?? null;
            if (mapId) {
                try {
                    const map = await getMapDetail(mapId);
                    setMapName(map.name);
                } catch {
                    setMapName(String(mapId));
                }
            } else {
                setMapName(null);
            }
        } catch (e) {
            setErr(safeMessage(e, t("workspace_detail.request_failed")));
        } finally {
            setLoading(false);
        }
    }, [orgId, bankId, t]);

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    const reloadQuestionBank = async () => {
        if (!bankId) return;
        try {
            const [reloadedBank, reloadedQuestions] = await Promise.all([
                getQuestionBank(bankId),
                getQuestionsOfQuestionBank(bankId),
            ]);
            setQuestionBank({ ...reloadedBank, questions: reloadedQuestions });
            return reloadedQuestions;
        } catch (e) {
            console.error("Failed to reload question bank", e);
            return null;
        }
    };

    return {
        org,
        workspace,
        questionBank,
        mapName,
        loading,
        err,
        reloadQuestionBank,
        setQuestionBank
    };
}
