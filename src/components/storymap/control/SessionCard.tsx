"use client";

import React from "react";
import type { SessionDto } from "@/lib/api-ques";
import type { BaseKey } from "@/types/common";
import type { GroupSubmissionDto } from "@/lib/hubs/groupCollaboration";

type LeaderboardEntry = {
  participantId?: string | null;
  displayName?: string | null;
  score?: number | null;
  rank?: number | null;
  totalCorrect?: number | null;
  totalAnswered?: number | null;
  sessionParticipantId?: string | null;
  id?: string | null;
};

type ParticipantEntry = {
  participantId?: string | null;
  displayName?: string | null;
  score?: number | null;
  rank?: number | null;

  totalAnswered?: number | null;
  // fallback keys (nếu backend trả khác tên)
  sessionParticipantId?: string | null;
  id?: string | null;
};

type GroupEntry = {
  groupId?: string | null;
  name?: string | null;
  color?: string | null;
  currentMembersCount?: number | null;
  maxMembers?: number | null;
};

type GroupMemberEntry = {
  groupMemberId?: string | null;
  participantName?: string | null;
  joinedAt?: string | null;
  isLeader?: boolean | null;
};

type Props = {
  session: SessionDto | null;
  changingStatus: boolean;

  questionBankCount: number;

  selectedLayer: BaseKey;
  onChangeLayer: (layer: BaseKey) => void;

  onChangeStatus: (action: "start" | "pause" | "resume" | "end") => void;

  onOpenShare: () => void;
  onCopyCode: () => void;

  onOpenResults: () => void;

  // ===== Leaderboard =====
  onViewLeaderboard: () => void;
  loadingLeaderboard: boolean;
  leaderboard: LeaderboardEntry[];

  // ===== Participants =====
  onLoadParticipants: () => void;
  loadingParticipants: boolean;
  participants: ParticipantEntry[];
  assignedParticipantIds: string[];
  selectedParticipantIds: string[];
  setSelectedParticipantIds: React.Dispatch<React.SetStateAction<string[]>>;

  // ===== Group Collaboration =====
  groupCollabConnected: boolean;
  onOpenCreateGroup: () => void;

  groups: GroupEntry[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;

  loadingGroupMembers: boolean;
  selectedGroupMembers: GroupMemberEntry[];

  children?: React.ReactNode;
};

function normalizeHexColor(input?: string | null) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const x = s.startsWith("#") ? s : `#${s}`;
  // #RGB or #RRGGBB
  if (/^#[0-9a-fA-F]{3}$/.test(x)) {
    const r = x[1],
      g = x[2],
      b = x[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(x)) return x.toLowerCase();
  return null;
}

function hexToRgba(hex: string, alpha: number) {
  const h = normalizeHexColor(hex);
  if (!h) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function SessionCard({
  session,
  changingStatus,
  questionBankCount,
  selectedLayer,
  onChangeLayer,
  onChangeStatus,
  onOpenShare,
  onCopyCode,
  onOpenResults,

  onViewLeaderboard,
  loadingLeaderboard,
  leaderboard,

  onLoadParticipants,
  loadingParticipants,
  participants,
  assignedParticipantIds,
  selectedParticipantIds,
  setSelectedParticipantIds,

  groupCollabConnected,
  onOpenCreateGroup,
  groups,
  selectedGroupId,
  onSelectGroup,
  onDeleteGroup,
  loadingGroupMembers,
  selectedGroupMembers,

  children,
}: Props) {
  const leaderboardById = React.useMemo(() => {
    const m = new Map<string, LeaderboardEntry>();
    (leaderboard ?? []).forEach((x) => {
      const id = (x.participantId ?? x.sessionParticipantId ?? x.id ?? "") as string;
      if (id) m.set(id, x);
    });
    return m;
  }, [leaderboard]);
  
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
            Phiên tương tác
          </p>
          <p className="text-xs text-zinc-400">Quản lý mã tham gia & trạng thái</p>
        </div>

        {session && (
          <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-700">
            ID: {session.sessionId.slice(0, 6)}…
          </span>
        )}
      </div>

      {/* MÃ CODE */}
      {session ? (
        <div className="space-y-2">
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-zinc-400">Code cho học sinh</p>
              <p className="font-mono text-xl font-semibold tracking-[0.18em] text-emerald-400">
                {session.sessionCode}
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenShare();
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] text-zinc-100 hover:bg-blue-700 border border-blue-500"
                title="Chia sẻ link hoặc QR code"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyCode();
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
              >
                <span>Copy</span>
              </button>
            </div>
          </div>

          {/* TRẠNG THÁI + NÚT */}
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Trạng thái:{" "}
              <span className="font-semibold text-zinc-100">{session.status}</span>
            </span>

            {questionBankCount > 0 && (
              <span className="text-right">
                Bộ câu hỏi:&nbsp;
                <span className="font-semibold text-emerald-300">{questionBankCount} bộ</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => onChangeStatus("start")}
              disabled={changingStatus || session.status === "Running"}
              className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-emerald-500/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => onChangeStatus("pause")}
              disabled={changingStatus || session.status !== "Running"}
              className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-amber-400/70 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() => onChangeStatus("resume")}
              disabled={changingStatus || session.status !== "Paused"}
              className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-sky-400/70 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => onChangeStatus("end")}
              disabled={changingStatus || session.status === "Ended"}
              className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-rose-500/70 bg-rose-600/10 text-rose-100 hover:bg-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              End
            </button>
          </div>

          {(session.status === "Ended" || session.status === "Completed") && (
            <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-emerald-200">Session đã kết thúc — xem tổng kết.</p>
                <button
                  type="button"
                  onClick={onOpenResults}
                  className="shrink-0 inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-emerald-500 border border-emerald-500/60"
                >
                  Tổng kết session
                </button>
              </div>
            </div>
          )}

          {/* LAYER SYNC */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800 mt-2">
            <p className="text-[11px] text-zinc-400">🗺️ Base Map:</p>
            <select
              value={selectedLayer}
              onChange={(e) => onChangeLayer(e.target.value as BaseKey)}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="osm">OpenStreetMap</option>
              <option value="sat">Satellite</option>
              <option value="dark">Dark</option>
              <option value="positron">Light</option>
              <option value="terrain">Terrain</option>
              <option value="topo">Topographic</option>
            </select>
          </div>

          {/* ===== 1) LEADERBOARD ===== */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-zinc-500">HS truy cập link lớp học rồi nhập code ở trên.</p>
            <button
              type="button"
              onClick={onViewLeaderboard}
              className="text-[11px] text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline"
            >
              Xem bảng xếp hạng
            </button>
          </div>

          <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1">
            {loadingLeaderboard && (
              <p className="text-[11px] text-zinc-500">Đang tải bảng xếp hạng...</p>
            )}

            {!loadingLeaderboard && leaderboard.length === 0 && (
              <p className="text-[11px] text-zinc-500">Chưa có dữ liệu bảng xếp hạng.</p>
            )}

            {!loadingLeaderboard && leaderboard.length > 0 && (
              <div className="space-y-1">
                {leaderboard.map((p, idx) => {
                  const place = Number(p.rank ?? idx + 1);
                  const isTop1 = place === 1;
                  const isTop2 = place === 2;
                  const isTop3 = place === 3;

                  const rowCls =
                    "flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-[11px] " +
                    (isTop1
                      ? "border-amber-400/70 bg-gradient-to-r from-amber-500/25 via-amber-500/10 to-transparent"
                      : isTop2
                        ? "border-zinc-300/30 bg-gradient-to-r from-zinc-200/10 via-zinc-200/5 to-transparent"
                        : isTop3
                          ? "border-orange-400/60 bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent"
                          : "border-zinc-800 bg-zinc-950/30");

                  const badgeCls =
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-bold border " +
                    (isTop1
                      ? "border-amber-400/70 bg-amber-500/15 text-amber-200"
                      : isTop2
                        ? "border-zinc-200/30 bg-zinc-200/10 text-zinc-100"
                        : isTop3
                          ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
                          : "border-zinc-700 bg-zinc-900 text-zinc-300");

                  return (
                    <div key={(p.participantId ?? idx) as any} className={rowCls}>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={badgeCls}>#{place}</span>

                        <div className="min-w-0">
                          <p
                            className={
                              "truncate font-semibold " +
                              (isTop1
                                ? "text-amber-200"
                                : isTop2
                                  ? "text-zinc-100"
                                  : isTop3
                                    ? "text-orange-200"
                                    : "text-zinc-200")
                            }
                          >
                            {p.displayName ?? "—"}
                          </p>

                          {(isTop1 || isTop2 || isTop3) && (
                            <p
                              className={
                                "mt-0.5 text-[10px] " +
                                (isTop1
                                  ? "text-amber-300/90"
                                  : isTop2
                                    ? "text-zinc-300"
                                    : "text-orange-300/90")
                              }
                            >
                              {isTop1 ? "Top 1" : isTop2 ? "Top 2" : "Top 3"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={
                            "text-[12px] font-extrabold " +
                            (isTop1
                              ? "text-amber-200"
                              : isTop2
                                ? "text-zinc-100"
                                : isTop3
                                  ? "text-orange-200"
                                  : "text-zinc-200")
                          }
                        >
                          {p.score ?? 0}
                        </p>
                        <p className="text-[10px] text-zinc-500">điểm</p>
                        {typeof p.totalCorrect === "number" && (
                          <p className="text-[10px] text-zinc-500">
                            Đúng: {p.totalCorrect}
                            {typeof p.totalAnswered === "number" ? `/${p.totalAnswered}` : ""}
                          </p>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===== 2) PARTICIPANTS ===== */}
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                Danh sách người tham gia
              </p>
              <button
                type="button"
                onClick={onLoadParticipants}
                disabled={loadingParticipants}
                className="text-[10px] text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {loadingParticipants ? "Đang tải..." : "Làm mới"}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1.5">
              {loadingParticipants && (
                <p className="text-[11px] text-zinc-500">Đang tải danh sách...</p>
              )}

              {!loadingParticipants && participants.length === 0 && (
                <p className="text-[11px] text-zinc-500">Chưa có người tham gia nào.</p>
              )}

              {!loadingParticipants &&
                participants.length > 0 &&
                participants.map((p, idx) => {
                  const id =
                    (p.participantId ?? p.sessionParticipantId ?? p.id ?? undefined) as
                    | string
                    | undefined;

                  if (!id) return null;

                  const isAssigned = assignedParticipantIds.includes(id);
                  const isSelected = selectedParticipantIds.includes(id);

                  return (
                    <div
                      key={id ?? idx}
                      className="flex items-center justify-between text-[11px] text-zinc-200 py-1 border-b border-zinc-800/50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={isAssigned}
                          checked={isSelected}
                          onChange={() => {
                            if (isAssigned) return;
                            setSelectedParticipantIds((prev) =>
                              prev.includes(id)
                                ? prev.filter((x) => x !== id)
                                : [...prev, id]
                            );
                          }}
                          className="h-3 w-3 rounded border-zinc-600 bg-zinc-900 text-emerald-400 focus:ring-emerald-500"
                        />

                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                          {p.rank ?? idx + 1}
                        </span>
                        <span className="text-zinc-100">{p.displayName ?? "—"}</span>

                        {isAssigned && (
                          <span className="ml-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-1.5 py-[1px] text-[9px] text-emerald-300">
                            Đã có nhóm
                          </span>
                        )}
                      </div>

                      {(() => {
  const answered =
    typeof p.totalAnswered === "number"
      ? p.totalAnswered
      : (leaderboardById.get(id)?.totalAnswered ?? undefined);

  return typeof answered === "number" ? (
    <span className="font-semibold text-emerald-400">{answered} câu</span>
  ) : null;
})()}

                    </div>
                  );
                })}
            </div>

            {participants.length > 0 && (
              <p className="mt-1.5 text-[10px] text-zinc-500 text-right">
                Tổng: {participants.length} người tham gia
              </p>
            )}
          </div>

          {/* ===== 3) GROUP COLLAB ===== */}
          <section className="mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                Hoạt động nhóm
              </p>
              <button
                type="button"
                disabled={!groupCollabConnected}
                onClick={onOpenCreateGroup}
                className="text-[11px] rounded-lg px-2.5 py-1 bg-emerald-600 text-zinc-100 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed"
              >
                {groupCollabConnected ? "+ Tạo nhóm" : "Đang kết nối..."}
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1.5">
              {groups.length === 0 ? (
                <p className="text-[11px] text-zinc-500">
                  Chưa có nhóm nào. Bấm &quot;Tạo nhóm&quot; để bắt đầu.
                </p>
              ) : (
                groups.map((g, idx) => {
                  const gid = (g.groupId ?? undefined) as string | undefined;
                  if (!gid) return null;

                  const isSelected = gid === selectedGroupId;

                  const groupColor = normalizeHexColor((g as any).color ?? g.color);
                  const bg = groupColor
                    ? hexToRgba(groupColor, isSelected ? 0.18 : 0.1)
                    : undefined;

                  return (
                    <div
                      key={gid ?? idx}
                      onClick={() => onSelectGroup(gid)}
                      className={
                        "w-full flex items-center justify-between text-[11px] py-1.5 px-2 rounded-md border mb-[2px] last:mb-0 cursor-pointer " +
                        "border-zinc-800 hover:bg-zinc-900/70 border-l-4 " +
                        (isSelected ? "text-zinc-50" : "text-zinc-200")
                      }
                      style={{
                        backgroundColor: bg,
                        borderLeftColor: groupColor ?? undefined,
                        boxShadow:
                          isSelected && groupColor
                            ? `0 0 0 1px ${hexToRgba(groupColor, 0.55)}`
                            : undefined,
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-[3px] h-2.5 w-2.5 rounded-full border border-zinc-800"
                          style={{ backgroundColor: groupColor ?? "#3f3f46" }}
                          title={groupColor ?? undefined}
                        />
                        <div>
                          <p className="font-semibold">{g.name || `Nhóm ${idx + 1}`}</p>

                          {typeof g.currentMembersCount === "number" &&
                            typeof g.maxMembers === "number" && (
                              <p className={isSelected ? "text-zinc-200" : "text-zinc-400"}>
                                {g.currentMembersCount}/{g.maxMembers} thành viên
                              </p>
                            )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGroup(gid);
                        }}
                        className="ml-2 inline-flex items-center justify-center rounded-full border border-rose-500/70 bg-rose-600/10 text-rose-200 hover:bg-rose-600/20 px-2 py-[2px] text-[10px]"
                      >
                        Xóa
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chi tiết thành viên */}
            {selectedGroupId && (
              <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                    Thành viên trong nhóm
                  </p>
                  {loadingGroupMembers ? (
                    <span className="text-[10px] text-zinc-400">Đang tải...</span>
                  ) : (
                    <span className="text-[10px] text-zinc-400">
                      {selectedGroupMembers.length} thành viên
                    </span>
                  )}
                </div>

                {loadingGroupMembers ? (
                  <p className="text-[11px] text-zinc-500">Đang tải danh sách thành viên...</p>
                ) : selectedGroupMembers.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">Chưa có thành viên nào trong nhóm này.</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1.5">
                    {selectedGroupMembers.map((m, index) => (
                      <div
                        key={(m.groupMemberId ?? index) as any}
                        className="flex items-center justify-between text-[11px] text-zinc-200 border-b border-zinc-800/60 pb-1 last:border-0"
                      >
                        <div>
                          <p className="font-medium">
                            {m.participantName || `Thành viên ${index + 1}`}
                          </p>
                          <p className="text-zinc-500">Tham gia lúc: {m.joinedAt ?? "—"}</p>
                        </div>
                        {!!m.isLeader && (
                          <span className="ml-2 rounded-full bg-emerald-500/15 border border-emerald-400/60 px-2 py-[1px] text-[10px] text-emerald-200">
                            Nhóm trưởng
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {children}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          Chưa có session cho bản đồ này. Hãy quay lại workspace và tạo session từ đó.
        </div>
      )}
    </section>
  );
}
