"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { getSegments, type Segment } from "@/lib/api-storymap";
import { getMapDetail } from "@/lib/api-maps";
import StoryMapViewer from "@/components/storymap/StoryMapViewer";

import {
  getCurrentQuestionForParticipant,
  submitParticipantResponse,
  type SessionRunningQuestionDto,
} from "@/lib/api-ques";

export default function StoryMapViewPage() {
  const params = useParams<{ mapId: string }>();
  const searchParams = useSearchParams();
  const mapId = params?.mapId ?? "";
  const sessionId = searchParams.get("sessionId") ?? "";

  const [displayName, setDisplayName] = useState("Học sinh");
  const [sessionCode, setSessionCode] = useState("");
  const [participantId, setParticipantId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedName = window.sessionStorage.getItem("imos_student_name");
    const storedCode = window.sessionStorage.getItem("imos_session_code");
    const storedParticipant = window.sessionStorage.getItem("imos_participant_id");

    if (storedName) setDisplayName(storedName);
    if (storedCode) setSessionCode(storedCode);

    if (storedParticipant) {
      setParticipantId(storedParticipant);
    } else if (sessionId) {
      setError(
        "Không tìm thấy thông tin học viên cho tiết học này. Vui lòng quay lại trang trước và tham gia lại bằng mã tiết học."
      );
      setLoading(false);
    }
  }, [sessionId]);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mapDetail, setMapDetail] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const [question, setQuestion] = useState<SessionRunningQuestionDto | null>(
    null
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapId) return;

    const ch = new BroadcastChannel(`storymap-${mapId}`);
    broadcastRef.current = ch;

    ch.onmessage = (ev) => {
      if (ev?.data?.type === "segment-change") {
        const idx = ev.data.segmentIndex as number;
        if (typeof idx === "number") {
          setCurrentIndex(idx);
        }
      }
    };

    return () => {
      ch.close();
      broadcastRef.current = null;
    };
  }, [mapId]);

  useEffect(() => {
    if (!mapId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [detail, segs] = await Promise.all([
          getMapDetail(mapId),
          getSegments(mapId),
        ]);

        if (detail.status !== "Published" && !detail.isPublic) {
          setError(
            "Bản đồ này chưa được publish hoặc không công khai, không thể tham gia tiết học."
          );
          return;
        }

        setMapDetail(detail);
        setSegments(segs);
      } catch (e: any) {
        console.error("Load student view failed:", e);
        setError(e?.message || "Không tải được bản đồ.");
      } finally {
        setLoading(false);
      }
    })();
  }, [mapId]);

  // ================== Poll câu hỏi hiện tại cho student ==================
  useEffect(() => {
    if (!participantId) return;

    const fetchQuestion = async () => {
      try {
        const q = await getCurrentQuestionForParticipant(participantId);
        setQuestion(q ?? null);
        setSelectedOptionId(null);
        setInfoMessage(null);
      } catch (e) {
        console.error("Fetch current question for participant failed:", e);
      }
    };

    fetchQuestion();

    pollTimerRef.current = setInterval(fetchQuestion, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [participantId]);

  // ================== Gửi đáp án ==================
  const handleSubmitAnswer = async () => {
    if (!participantId || !question || !selectedOptionId) {
      setInfoMessage("Vui lòng chọn một đáp án trước khi gửi.");
      return;
    }

    try {
      setAnswering(true);
      setInfoMessage(null);

      await submitParticipantResponse(participantId, {
        sessionQuestionId: question.sessionQuestionId,
        questionOptionId: selectedOptionId,
      });

      setInfoMessage(
        "Đã gửi đáp án. Vui lòng chờ giáo viên chuyển câu hỏi tiếp theo."
      );
    } catch (e: any) {
      console.error("Submit answer failed:", e);
      setInfoMessage(
        e?.message ||
        "Gửi đáp án thất bại. Vui lòng kiểm tra kết nối và thử lại."
      );
    } finally {
      setAnswering(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400 mx-auto mb-4" />
          <p className="text-sm text-zinc-300">Đang tải tiết học…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="max-w-md text-center space-y-3 px-4">
          <p className="text-lg font-semibold text-rose-400">
            Không thể tham gia tiết học
          </p>
          <p className="text-sm text-zinc-300">{error}</p>
        </div>
      </div>
    );
  }

  const center: [number, number] = mapDetail?.center
    ? [mapDetail.center.latitude, mapDetail.center.longitude]
    : [10.8231, 106.6297]; // fallback Sài Gòn

  const currentSegment = segments[currentIndex];

  // ================== MAIN LAYOUT ==================
  return (
    <div className="h-screen flex bg-zinc-950 text-zinc-50">
      <div className="w-[360px] border-r border-zinc-800 bg-zinc-950/95 flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-medium">
            Tham gia tiết học
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white truncate">
            {mapDetail?.name || "Bản đồ chưa đặt tên"}
          </h1>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-[11px] text-zinc-400">
              <p className="font-semibold text-zinc-200">{displayName}</p>
              {currentSegment && (
                <p className="mt-0.5">
                  Đang xem:{" "}
                  <span className="text-zinc-50">
                    {currentIndex + 1}. {currentSegment.name || "Segment"}
                  </span>
                </p>
              )}
              {sessionId && (
                <p className="mt-0.5">
                  Session:{" "}
                  <span className="font-mono text-zinc-400 text-[10px]">
                    {sessionId}
                  </span>
                </p>
              )}
            </div>

            {sessionCode && (
              <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-right">
                <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                  Mã tiết học
                </p>
                <p className="mt-1 text-base font-mono font-semibold text-emerald-200">
                  {sessionCode}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-4">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
                Câu hỏi hiện tại
              </p>
              {question && (
                <span className="text-[11px] text-zinc-400">
                  {question.points ?? 0} điểm · {question.timeLimit ?? 0}s
                </span>
              )}
            </div>

            {!question && (
              <p className="text-[12px] text-zinc-400">
                Giáo viên chưa bắt đầu hoặc đang chuyển câu hỏi. Vui lòng chờ…
              </p>
            )}

            {question && (
              <>
                <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 px-3 py-2">
                  <p className="text-[11px] text-zinc-400 mb-1">
                    Câu hỏi cho cả lớp
                  </p>
                  <p className="text-sm text-zinc-50 whitespace-pre-wrap">
                    {question.questionText}
                  </p>
                </div>

                {question.options && question.options.length > 0 && (
                  <div className="space-y-1.5">
                    {question.options
                      .slice()
                      .sort(
                        (a, b) =>
                          (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
                      )
                      .map((opt) => (
                        <label
                          key={opt.id ?? opt.optionText}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer text-[13px] transition ${selectedOptionId ===
                            (opt.id as string | undefined)
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-50"
                            : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500"
                            }`}
                        >
                          <input
                            type="radio"
                            name="answer"
                            value={opt.id}
                            checked={
                              selectedOptionId ===
                              (opt.id as string | undefined)
                            }
                            onChange={() =>
                              setSelectedOptionId(opt.id as string)
                            }
                            className="mt-[3px] h-3 w-3 accent-emerald-500"
                          />
                          <span>{opt.optionText || "(Không có nội dung)"}</span>
                        </label>
                      ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={answering || !selectedOptionId}
                  className="mt-2 inline-flex justify-center w-full rounded-lg px-3 py-2 text-[13px] font-medium border border-emerald-500/70 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Gửi đáp án
                </button>
              </>
            )}

            {infoMessage && (
              <p className="text-[11px] text-zinc-400 mt-1">{infoMessage}</p>
            )}
          </section>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <StoryMapViewer
          mapId={mapId}
          segments={segments}
          baseMapProvider={mapDetail?.baseMapProvider}
          initialCenter={center}
          initialZoom={mapDetail?.defaultZoom || 10}
          onSegmentChange={(_, idx) => setCurrentIndex(idx)}
        />
      </div>
    </div>
  );
}
