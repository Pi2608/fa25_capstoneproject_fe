"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  createSession,
  getMyQuestionBanks,
  type QuestionBankDto,
} from "@/lib/api-ques";
import { getOrganizationById } from "@/lib/api-organizations";
import {
  getProjectsByOrganization,
  type Workspace,
} from "@/lib/api-workspaces";

export default function OrganizationCreateSessionPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const router = useRouter();

  const [orgName, setOrgName] = useState<string>("");
  const [questionBanks, setQuestionBanks] = useState<QuestionBankDto[]>([]);
  const [allBanksCount, setAllBanksCount] = useState(0);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Session settings (reuse defaults from /session/create)
  const [sessionName, setSessionName] = useState("");
  const [description, setDescription] = useState("");
  const [sessionType, setSessionType] = useState<"live" | "practice">("live");
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [allowLateJoin, setAllowLateJoin] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [enableHints, setEnableHints] = useState(true);
  const [pointsForSpeed, setPointsForSpeed] = useState(true);

  const selectedBank = useMemo(
    () => questionBanks.find((b) => b.id === selectedBankId),
    [questionBanks, selectedBankId]
  );

  useEffect(() => {
    if (!orgId) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [banks, ws, org] = await Promise.all([
          getMyQuestionBanks(),
          getProjectsByOrganization(orgId),
          getOrganizationById(orgId),
        ]);

        setOrgName(org?.organization?.orgName ?? "");
        setWorkspaces(ws);
        setAllBanksCount(banks.length);

        const workspaceIds = new Set(
          ws
            .map((w) => w.workspaceId || (w as any).id || "")
            .filter(Boolean)
        );

        const shouldFilter = workspaceIds.size > 0;
        const filteredBanks = shouldFilter
          ? banks.filter((bank) =>
              bank.workspaceId ? workspaceIds.has(bank.workspaceId) : false
            )
          : banks;

        setQuestionBanks(filteredBanks);
      } catch (error) {
        console.error("Failed to load question banks for organization:", error);
        toast.error("Không tải được danh sách bộ câu hỏi của tổ chức");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [orgId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBankId || !selectedBank) {
      toast.error("Vui lòng chọn bộ câu hỏi");
      return;
    }

    if (!selectedBank.mapId) {
      toast.error("Bộ câu hỏi phải gắn với một bản đồ trước khi tạo session");
      return;
    }

    setIsCreating(true);
    try {
      const session = await createSession({
        mapId: selectedBank.mapId,
        questionBankId: selectedBankId,
        sessionName: sessionName || `${selectedBank.bankName} Session`,
        description,
        sessionType,
        maxParticipants: maxParticipants || undefined,
        allowLateJoin,
        showLeaderboard,
        showCorrectAnswers,
        shuffleQuestions,
        shuffleOptions,
        enableHints,
        pointsForSpeed,
      });

      toast.success("Tạo session thành công!");

      const params = new URLSearchParams({
        sessionId: session.id,
        sessionCode: session.sessionCode,
        questionBankId: selectedBankId,
      });

      if (selectedBank.bankName) params.set("bankName", selectedBank.bankName);
      if (selectedBank.description)
        params.set("bankDescription", selectedBank.description);
      if (selectedBank.category) params.set("category", selectedBank.category);
      if (selectedBank.tags && Array.isArray(selectedBank.tags) && selectedBank.tags.length > 0) {
        params.set("tags", selectedBank.tags.join(","));
      }
      if (
        selectedBank.totalQuestions !== null &&
        selectedBank.totalQuestions !== undefined
      ) {
        params.set("totalQuestions", selectedBank.totalQuestions.toString());
      }
      if (selectedBank.workspaceName)
        params.set("workspaceName", selectedBank.workspaceName);
      if (selectedBank.mapName) params.set("mapName", selectedBank.mapName);
      if (selectedBank.createdAt) params.set("createdAt", selectedBank.createdAt);
      if (selectedBank.updatedAt) params.set("updatedAt", selectedBank.updatedAt);

      router.push(`/storymap/control/${selectedBank.mapId}?${params.toString()}`);
    } catch (error: any) {
      console.error("Failed to create session inside organization:", error);
      toast.error(error?.message || "Không thể tạo session");
    } finally {
      setIsCreating(false);
    }
  };

  if (!orgId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e] flex items-center justify-center">
        <div className="text-center text-zinc-600 dark:text-zinc-400">
          Organization not found.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Đang tải dữ liệu tổ chức...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
      <header className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {orgName || "Organization"}
            </p>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Tạo session mới
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Chọn bộ câu hỏi thuộc tổ chức để tạo session
            </p>
          </div>
          <button
            onClick={() => router.push(`/profile/organizations/${orgId}`)}
            className="px-4 py-2 text-zinc-600 dark:text-zinc-200 hover:bg-muted rounded-lg transition-colors"
          >
            ← Quay lại tổ chức
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <form onSubmit={handleCreateSession} className="space-y-6">
          <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                1. Chọn bộ câu hỏi
              </h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {questionBanks.length} bộ hiển thị (
                {allBanksCount} tổng cộng)
              </span>
            </div>

            {questionBanks.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📚</div>
                <div className="text-zinc-600 dark:text-zinc-400 mb-2">
                  Tổ chức chưa có bộ câu hỏi nào
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Vào trang Bộ câu hỏi trong tổ chức để tạo hoặc gắn bộ câu hỏi
                  với workspace trước khi tạo session.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/profile/organizations/${orgId}/question-banks`)
                  }
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                >
                  Quản lý bộ câu hỏi
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {questionBanks.map((bank) => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => setSelectedBankId(bank.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedBankId === bank.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
                        : "border-border hover:border-emerald-300"
                    }`}
                  >
                    <div className="font-semibold text-lg mb-1">
                      {bank.bankName}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 line-clamp-2">
                      {bank.description || "Không có mô tả"}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span>📝 {bank.totalQuestions || 0} câu hỏi</span>
                      {bank.workspaceName && <span>💼 {bank.workspaceName}</span>}
                      {bank.mapName && <span>🗺️ {bank.mapName}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {questionBanks.length > 0 && selectedBankId && (
            <>
              <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                  2. Thông tin session
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                      Tên session
                    </label>
                    <input
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder={`${selectedBank?.bankName ?? "Session"}`}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                      Mô tả
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Thêm mô tả cho session..."
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                        Loại session
                      </label>
                      <select
                        value={sessionType}
                        onChange={(e) =>
                          setSessionType(e.target.value as "live" | "practice")
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="live">Live</option>
                        <option value="practice">Practice</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                        Số người tối đa (0 = không giới hạn)
                      </label>
                      <input
                        type="number"
                        value={maxParticipants}
                        onChange={(e) =>
                          setMaxParticipants(parseInt(e.target.value) || 0)
                        }
                        min={0}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                  3. Thiết lập session
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      id: "allowLateJoin",
                      label: "Cho phép vào muộn",
                      description: "Học sinh có thể tham gia sau khi đã bắt đầu",
                      value: allowLateJoin,
                      onChange: setAllowLateJoin,
                    },
                    {
                      id: "showLeaderboard",
                      label: "Hiển thị bảng xếp hạng",
                      description: "Cập nhật điểm theo thời gian thực",
                      value: showLeaderboard,
                      onChange: setShowLeaderboard,
                    },
                    {
                      id: "showCorrectAnswers",
                      label: "Hiển thị đáp án đúng",
                      description: "Cho phép xem đáp án sau khi trả lời",
                      value: showCorrectAnswers,
                      onChange: setShowCorrectAnswers,
                    },
                    {
                      id: "shuffleQuestions",
                      label: "Xáo trộn câu hỏi",
                      description: "Ngẫu nhiên thứ tự câu hỏi",
                      value: shuffleQuestions,
                      onChange: setShuffleQuestions,
                    },
                    {
                      id: "shuffleOptions",
                      label: "Xáo trộn đáp án",
                      description: "Ngẫu nhiên thứ tự đáp án",
                      value: shuffleOptions,
                      onChange: setShuffleOptions,
                    },
                    {
                      id: "enableHints",
                      label: "Cho phép gợi ý",
                      description: "Học sinh có thể xem gợi ý",
                      value: enableHints,
                      onChange: setEnableHints,
                    },
                    {
                      id: "pointsForSpeed",
                      label: "Cộng điểm tốc độ",
                      description: "Trả lời nhanh nhận thêm điểm",
                      value: pointsForSpeed,
                      onChange: setPointsForSpeed,
                    },
                  ].map((setting) => (
                    <label
                      key={setting.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={setting.value}
                        onChange={(e) => setting.onChange(e.target.checked)}
                        className="mt-1 w-5 h-5"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {setting.label}
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          {setting.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/profile/organizations/${orgId}`)}
                  className="px-6 py-3 bg-muted hover:bg-muted/80 text-zinc-900 dark:text-zinc-100 font-semibold rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !selectedBankId}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-muted text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-3 border-white border-t-transparent rounded-full"></div>
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <span>Tạo session</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
}





