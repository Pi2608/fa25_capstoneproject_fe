import { useState, useEffect } from "react";
import { useToast } from "@/contexts/ToastContext";
import { QuestionBankDto } from "@/lib/api-session";
import { getWorkspaceMaps } from "@/lib/api-workspaces";
import { MapOption, mapWorkspaceMapsToOptions } from "./question-bank-common";

export function useAttachDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [bank, setBank] = useState<QuestionBankDto | null>(null);
    const [maps, setMaps] = useState<MapOption[]>([]);
    const [selectedMapId, setSelectedMapId] = useState("");
    const { showToast } = useToast();

    const open = (b: QuestionBankDto) => {
        setBank(b);
        setSelectedMapId((b as any).mapId ? String((b as any).mapId) : "");
        setIsOpen(true);
    };

    const close = () => {
        setIsOpen(false);
        setBank(null);
        setMaps([]);
        setSelectedMapId("");
    };

    useEffect(() => {
        if (!isOpen || !bank) return;
        const workspaceId = (bank as any).workspaceId ?? "";
        if (!workspaceId) return setMaps([]);

        let cancelled = false;
        getWorkspaceMaps(workspaceId)
            .then(rawMaps => {
                if (cancelled) return;
                const options = mapWorkspaceMapsToOptions(rawMaps);
                setMaps(options);
                const preferredId = (bank as any).mapId ?? "";
                setSelectedMapId(options.find(o => o.id === String(preferredId))?.id ?? "");
            })
            .catch(() => {
                if (!cancelled) {
                    setMaps([]);
                    showToast("error", "Không thể tải danh sách storymap");
                }
            });
        return () => { cancelled = true; };
    }, [isOpen, bank, showToast]);

    return { isOpen, bank, maps, selectedMapId, setSelectedMapId, open, close };
}
