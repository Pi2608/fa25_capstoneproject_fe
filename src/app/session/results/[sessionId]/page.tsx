"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Leaderboard } from "@/components/session/Leaderboard";
import { getSession, getSessionLeaderboard, getSessionSummary, SessionSummaryDto, QuestionBreakdownDto } from "@/lib/api-session";
import type { LeaderboardEntry } from "@/types/session";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  Target,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Printer,
  ArrowLeft,
  Award,
  Timer,
  MapPin,
} from "lucide-react";

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];
const DIFFICULTY_COLORS = {
  "Dễ": "#10b981",
  "Trung bình": "#f59e0b",
  "Khó": "#ef4444",
};

export default function SessionResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [summary, setSummary] = useState<SessionSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "participants">("overview");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const [sessionData, leaderboardData, summaryData] = await Promise.all([
          getSession(sessionId),
          getSessionLeaderboard(sessionId, 100),
          getSessionSummary(sessionId).catch(() => null),
        ]);

        setSession(sessionData);
        setSummary(summaryData);
        setLeaderboard(
          leaderboardData
            .map((entry) => ({
              participantId: entry.participantId ?? entry.sessionParticipantId ?? "",
              displayName: entry.displayName ?? "",
              score: entry.score ?? entry.totalScore ?? 0,
              rank: entry.rank ?? 0,
              totalCorrect: entry.totalCorrect ?? 0,
              totalAnswered: entry.totalAnswered ?? 0,
              averageResponseTime: entry.averageResponseTime ?? 0,
              isCurrentUser: entry.isCurrentUser ?? false,
            }))
            .filter((e) => e.participantId)
        );
      } catch (error) {
        console.error("Failed to fetch results:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  const toggleQuestionExpand = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const scoreDistributionData = useMemo(() => {
    if (!summary?.scoreDistribution) return [];
    return summary.scoreDistribution.map((bucket) => ({
      name: bucket.label,
      count: bucket.count,
      percentage: bucket.percentage,
    }));
  }, [summary]);

  const accuracyData = useMemo(() => {
    if (!summary?.statistics) return [];
    return [
      { name: "Đúng", value: summary.statistics.totalCorrectAnswers, color: "#10b981" },
      { name: "Sai", value: summary.statistics.totalIncorrectAnswers, color: "#ef4444" },
    ];
  }, [summary]);

  const questionTypeData = useMemo(() => {
    if (!summary?.questionBreakdowns) return [];
    const typeCount: Record<string, number> = {};
    summary.questionBreakdowns.forEach((q) => {
      const type = q.questionType;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    const typeNames: Record<string, string> = {
      MULTIPLE_CHOICE: "Trắc nghiệm",
      TRUE_FALSE: "Đúng/Sai",
      SHORT_ANSWER: "Trả lời ngắn",
      PIN_ON_MAP: "Ghim trên bản đồ",
      FILL_IN_THE_BLANK: "Điền vào chỗ trống",
    };
    return Object.entries(typeCount).map(([type, count], index) => ({
      name: typeNames[type] || type,
      value: count,
      color: COLORS[index % COLORS.length],
    }));
  }, [summary]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Đang tải kết quả...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Tổng kết tiết học
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Mã: <span className="font-mono font-bold">{session?.sessionCode}</span>
                {summary && ` • ${summary.durationMinutes} phút`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              In
            </button>
            <button
              onClick={() => router.push("/session/create")}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              Tạo mới
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              activeTab === "overview"
                ? "bg-background shadow-sm text-emerald-600"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Tổng quan
          </button>
          <button
            onClick={() => setActiveTab("questions")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              activeTab === "questions"
                ? "bg-background shadow-sm text-emerald-600"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <HelpCircle className="w-4 h-4 inline mr-2" />
            Phân tích câu hỏi
          </button>
          <button
            onClick={() => setActiveTab("participants")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              activeTab === "participants"
                ? "bg-background shadow-sm text-emerald-600"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Người tham gia
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Key Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatCard
                icon={<Users className="w-5 h-5 text-blue-500" />}
                label="Người tham gia"
                value={summary?.statistics.totalParticipants ?? leaderboard.length}
                bgColor="bg-blue-50 dark:bg-blue-900/20"
              />
              <StatCard
                icon={<HelpCircle className="w-5 h-5 text-purple-500" />}
                label="Số câu hỏi"
                value={summary?.statistics.totalQuestions ?? 0}
                bgColor="bg-purple-50 dark:bg-purple-900/20"
              />
              <StatCard
                icon={<Target className="w-5 h-5 text-emerald-500" />}
                label="Độ chính xác TB"
                value={`${(summary?.statistics.averageAccuracyPercent ?? 0).toFixed(1)}%`}
                bgColor="bg-emerald-50 dark:bg-emerald-900/20"
              />
              <StatCard
                icon={<Clock className="w-5 h-5 text-amber-500" />}
                label="Thời gian TB"
                value={`${(summary?.statistics.averageResponseTimeSeconds ?? 0).toFixed(1)}s`}
                bgColor="bg-amber-50 dark:bg-amber-900/20"
              />
              <StatCard
                icon={<Trophy className="w-5 h-5 text-yellow-500" />}
                label="Điểm cao nhất"
                value={summary?.statistics.highestScore ?? (leaderboard[0]?.score || 0)}
                bgColor="bg-yellow-50 dark:bg-yellow-900/20"
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5 text-pink-500" />}
                label="Điểm TB"
                value={(summary?.statistics.averageScore ?? 0).toFixed(0)}
                bgColor="bg-pink-50 dark:bg-pink-900/20"
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Score Distribution */}
              <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                  Phân bố điểm số
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => [
                          `${value} người`,
                          "Số lượng",
                        ]}
                        contentStyle={{
                          backgroundColor: "rgba(255,255,255,0.95)",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Accuracy Pie Chart */}
              <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                  Tỷ lệ đúng/sai
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={accuracyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {accuracyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Question Type Distribution */}
              {questionTypeData.length > 0 && (
                <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                    Phân bố loại câu hỏi
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={questionTypeData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {questionTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Participant Status */}
              <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                  Tình trạng tham gia
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <span className="text-zinc-700 dark:text-zinc-300">Hoàn thành phiên</span>
                    <span className="font-bold text-emerald-600">{summary?.participantAnalysis.activeThroughout ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <span className="text-zinc-700 dark:text-zinc-300">Rời sớm</span>
                    <span className="font-bold text-amber-600">{summary?.participantAnalysis.leftEarly ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-zinc-700 dark:text-zinc-300">Khách</span>
                    <span className="font-bold text-blue-600">{summary?.participantAnalysis.guestParticipants ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <span className="text-zinc-700 dark:text-zinc-300">Đã đăng ký</span>
                    <span className="font-bold text-purple-600">{summary?.participantAnalysis.registeredUsers ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top 3 Podium */}
            {leaderboard.length >= 3 && (
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl shadow-sm p-8">
                <h2 className="text-2xl font-bold text-center mb-8 text-zinc-900 dark:text-zinc-100">
                  🏆 Top 3 Xuất sắc 🏆
                </h2>
                <div className="flex items-end justify-center gap-4">
                  {/* 2nd Place */}
                  {leaderboard[1] && (
                    <div className="flex flex-col items-center">
                      <div className="text-6xl mb-2">🥈</div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-48 shadow-md">
                        <div className="text-center">
                          <div className="text-2xl font-bold mb-1 text-zinc-500">2nd</div>
                          <div className="font-semibold text-lg mb-2 truncate text-zinc-900 dark:text-zinc-100">
                            {leaderboard[1].displayName}
                          </div>
                          <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                            {leaderboard[1].score.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 1st Place */}
                  {leaderboard[0] && (
                    <div className="flex flex-col items-center transform scale-110">
                      <div className="text-7xl mb-2">🥇</div>
                      <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-600/30 dark:to-yellow-700/30 rounded-lg p-6 w-48 border-4 border-yellow-400 shadow-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold mb-1 text-yellow-700 dark:text-yellow-300">1st</div>
                          <div className="font-semibold text-lg mb-2 truncate text-zinc-900 dark:text-zinc-100">
                            {leaderboard[0].displayName}
                          </div>
                          <div className="text-4xl font-bold text-yellow-700 dark:text-yellow-300">
                            {leaderboard[0].score.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {leaderboard[2] && (
                    <div className="flex flex-col items-center">
                      <div className="text-6xl mb-2">🥉</div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-48 shadow-md">
                        <div className="text-center">
                          <div className="text-2xl font-bold mb-1 text-orange-500">3rd</div>
                          <div className="font-semibold text-lg mb-2 truncate text-zinc-900 dark:text-zinc-100">
                            {leaderboard[2].displayName}
                          </div>
                          <div className="text-3xl font-bold text-orange-600">
                            {leaderboard[2].score.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === "questions" && summary && (
          <div className="space-y-4">
            {summary.questionBreakdowns.map((question, index) => (
              <QuestionCard
                key={question.sessionQuestionId}
                question={question}
                index={index}
                isExpanded={expandedQuestions.has(question.sessionQuestionId)}
                onToggle={() => toggleQuestionExpand(question.sessionQuestionId)}
              />
            ))}
            {(!summary.questionBreakdowns || summary.questionBreakdowns.length === 0) && (
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <div>Không có dữ liệu câu hỏi</div>
              </div>
            )}
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === "participants" && (
          <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">
              Bảng xếp hạng cuối cùng
            </h2>
            {leaderboard.length > 0 ? (
              <Leaderboard
                entries={leaderboard}
                maxVisible={100}
                showAccuracy
                showResponseTime
                animated={false}
              />
            ) : (
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <div>Không có người tham gia trong phiên này</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

// Question Card Component
function QuestionCard({
  question,
  index,
  isExpanded,
  onToggle,
}: {
  question: QuestionBreakdownDto;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const questionTypeLabels: Record<string, string> = {
    MULTIPLE_CHOICE: "Trắc nghiệm",
    TRUE_FALSE: "Đúng/Sai",
    SHORT_ANSWER: "Trả lời ngắn",
    PIN_ON_MAP: "Ghim trên bản đồ",
    FILL_IN_THE_BLANK: "Điền vào chỗ trống",
  };

  const difficultyColor = DIFFICULTY_COLORS[question.difficultyLevel as keyof typeof DIFFICULTY_COLORS] || "#6b7280";

  return (
    <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold">
            {index + 1}
          </div>
          <div className="text-left">
            <div className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">
              {question.questionText}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-zinc-600 dark:text-zinc-400">
                {questionTypeLabels[question.questionType] || question.questionType}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: difficultyColor }}
              >
                {question.difficultyLevel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-sm text-zinc-500">Đúng</div>
            <div className="font-bold text-emerald-600">{question.correctPercentage}%</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-zinc-500">Trả lời</div>
            <div className="font-bold">{question.totalResponses}</div>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Đúng
              </div>
              <div className="text-xl font-bold text-emerald-600">{question.correctResponses}</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <XCircle className="w-4 h-4 text-red-500" />
                Sai
              </div>
              <div className="text-xl font-bold text-red-600">{question.incorrectResponses}</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Timer className="w-4 h-4 text-amber-500" />
                Thời gian TB
              </div>
              <div className="text-xl font-bold text-amber-600">{question.averageResponseTimeSeconds}s</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Award className="w-4 h-4 text-blue-500" />
                Điểm TB
              </div>
              <div className="text-xl font-bold text-blue-600">{question.averagePointsEarned.toFixed(0)}</div>
            </div>
          </div>

          {/* Option Analysis for Multiple Choice */}
          {question.optionAnalysis && question.optionAnalysis.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2 text-zinc-900 dark:text-zinc-100">Phân bố đáp án</h4>
              <div className="space-y-2">
                {question.optionAnalysis.map((option) => (
                  <div key={option.optionId} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${option.isCorrect ? "text-emerald-600 font-medium" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {option.optionText}
                        </span>
                        {option.isCorrect && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${option.isCorrect ? "bg-emerald-500" : "bg-zinc-400"}`}
                          style={{ width: `${option.selectPercentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm font-medium w-20 text-right">
                      {option.selectCount} ({option.selectPercentage}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common Answers for Short Answer */}
          {question.commonAnswers && question.commonAnswers.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2 text-zinc-900 dark:text-zinc-100">Câu trả lời phổ biến</h4>
              <div className="flex flex-wrap gap-2">
                {question.commonAnswers.map((answer, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-muted rounded-full text-sm"
                    style={{
                      fontSize: `${Math.max(12, Math.min(20, 12 + answer.count * 2))}px`,
                    }}
                  >
                    {answer.word} ({answer.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Distance Error for Pin on Map */}
          {question.questionType === "PIN_ON_MAP" && question.averageDistanceErrorMeters !== null && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                <span className="text-zinc-700 dark:text-zinc-300">
                  Khoảng cách trung bình đến đáp án đúng:{" "}
                  <strong className="text-blue-600">{question.averageDistanceErrorMeters?.toFixed(1)} m</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}