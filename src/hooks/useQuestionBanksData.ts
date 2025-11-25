import { useState, useCallback, useEffect } from "react";
import { OrganizationDetailDto, getOrganizationById } from "@/lib/api-organizations";
import { QuestionBankDto, getMyQuestionBanks, getPublicQuestionBanks, getQuestionBank } from "@/lib/api-ques";
import { getProjectsByOrganization } from "@/lib/api-workspaces";
import { Workspace } from "@/types/workspace";
import { BankExtra, normalizeTags, resolveBankId, safeMessage } from "./question-bank-common";

export function useQuestionBanksData(orgId: string) {
    const [org, setOrg] = useState<OrganizationDetailDto | null>(null);
    const [myBanks, setMyBanks] = useState<QuestionBankDto[]>([]);
    const [publicBanks, setPublicBanks] = useState<QuestionBankDto[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [bankDetails, setBankDetails] = useState<Record<string, BankExtra>>({});
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const fetchBankDetails = useCallback(async (banks: QuestionBankDto[]) => {
        const ids = [...new Set(banks.map(b => b.questionBankId).filter(Boolean))];
        if (!ids.length) return setBankDetails({});

        const results = await Promise.all(ids.map(id => getQuestionBank(id).catch(() => null)));
        setBankDetails(
            results.reduce((map, detail) => {
                if (detail?.questionBankId) {
                    map[detail.questionBankId] = {
                        totalQuestions: detail.totalQuestions ?? 0,
                        tags: normalizeTags(detail.tags),
                    };
                }
                return map;
            }, {} as Record<string, BankExtra>)
        );
    }, []);

    const loadAll = useCallback(async () => {
        if (!orgId) return;
        try {
            setLoading(true);
            setErr(null);
            const [orgRes, myRes, publicRes, wsRes] = await Promise.all([
                getOrganizationById(orgId),
                getMyQuestionBanks(),
                getPublicQuestionBanks(),
                getProjectsByOrganization(orgId),
            ]);
            setOrg(orgRes.organization);
            setMyBanks(myRes);
            setPublicBanks(publicRes);
            setWorkspaces(wsRes);
            await fetchBankDetails([...myRes, ...publicRes]);
        } catch (e) {
            setErr(safeMessage(e, "Không thể tải dữ liệu"));
        } finally {
            setLoading(false);
        }
    }, [orgId, fetchBankDetails]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const updateBanksMapId = (bankId: string, mapId: string) => {
        const updater = (prev: QuestionBankDto[]) =>
            prev.map(b => (resolveBankId(b) === bankId ? { ...b, mapId } : b));
        setMyBanks(updater);
        setPublicBanks(updater);
    };

    const removeBankFromList = (bankId: string) => {
        setMyBanks(prev => prev.filter(b => resolveBankId(b) !== bankId));
        setPublicBanks(prev => prev.filter(b => resolveBankId(b) !== bankId));
        setBankDetails(prev => { const next = { ...prev }; delete next[bankId]; return next; });
    };

    return {
        org, myBanks, publicBanks, workspaces, bankDetails,
        loading, err, loadAll, updateBanksMapId, removeBankFromList,
    };
}
