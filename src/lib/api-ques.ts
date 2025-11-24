import { getJson, postJson, putJson, delJson } from "./api-core";

export interface QuestionOptionDto {
  id?: string;
  optionText: string;
  optionImageUrl?: string | null;
  isCorrect: boolean;
  displayOrder: number;
}

export interface QuestionDto {
  id: string;
  questionBankId: string;
  locationId?: string | null;
  questionType: string;
  questionText: string;
  questionImageUrl?: string | null;
  questionAudioUrl?: string | null;
  points: number;
  timeLimit?: number | null;
  correctAnswerText?: string | null;
  correctLatitude?: number | null;
  correctLongitude?: number | null;
  acceptanceRadiusMeters?: number | null;
  hintText?: string | null;
  explanation?: string | null;
  displayOrder: number;
  options?: QuestionOptionDto[];
}

export interface QuestionBankDto {
  id: string;
  bankName: string;
  description?: string | null;
  category?: string | null;
  tags?: string | string[];
  workspaceId?: string | null;
  workspaceName?: string | null;
  mapId?: string | null;
  mapName?: string | null;
  isTemplate?: boolean;
  isPublic?: boolean;
  totalQuestions?: number;         
  questions?: QuestionDto[];    
  createdAt?: string;
  updatedAt?: string | null;
}

type QuestionBanksEnvelope = { questionBanks: QuestionBankDto[] };

function normalizeQuestionBank(raw: any): QuestionBankDto {
  if (!raw) {
    return {
      id: "",
      bankName: "",
      description: null,
      category: null,
      tags: "",
      workspaceId: null,
      workspaceName: null,
      mapId: null,
      mapName: null,
      isTemplate: false,
      isPublic: false,
      totalQuestions: 0,
      createdAt: undefined,
      updatedAt: null,
    };
  }

  const tagsRaw = raw.tags ?? raw.Tags ?? "";
  const tags =
    Array.isArray(tagsRaw)
      ? tagsRaw
      : typeof tagsRaw === "string"
        ? tagsRaw
        : "";

  const totalRaw =
    raw.totalQuestions ??
    raw.TotalQuestions ??
    (Array.isArray(raw.questions) ? raw.questions.length : 0);

  let totalQuestions = 0;
  if (typeof totalRaw === "number") {
    totalQuestions = totalRaw;
  } else if (typeof totalRaw === "string") {
    const n = Number(totalRaw);
    totalQuestions = Number.isFinite(n) ? n : 0;
  }

  return {
    id:
      raw.id ??
      raw.questionBankId ??
      raw.questionBankID ??
      raw.QuestionBankId ??
      "",
    bankName: raw.bankName ?? raw.BankName ?? "",
    description: raw.description ?? raw.Description ?? null,
    category: raw.category ?? raw.Category ?? null,
    tags,
    workspaceId: raw.workspaceId ?? raw.WorkspaceId ?? null,
    workspaceName: raw.workspaceName ?? raw.WorkspaceName ?? null,
    mapId: raw.mapId ?? raw.MapId ?? null,
    mapName: raw.mapName ?? raw.MapName ?? null,
    isTemplate: raw.isTemplate ?? raw.IsTemplate ?? false,
    isPublic: raw.isPublic ?? raw.IsPublic ?? false,
    totalQuestions,
    createdAt: raw.createdAt ?? raw.CreatedAt,
    updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? null,
  };
}

function asQuestionBanks(
  res: QuestionBanksEnvelope | QuestionBankDto[]
): QuestionBankDto[] {
  const list = Array.isArray(res) ? res : res.questionBanks ?? [];
  return list.map(normalizeQuestionBank);
}

export interface CreateQuestionBankRequest {
  bankName: string;
  description?: string | null;
  category?: string | null;
  tags?: string[] | string;
  workspaceId?: string;
  mapId?: string;
  isTemplate?: boolean;
  isPublic?: boolean;
}

export async function createQuestionBank(
  req: CreateQuestionBankRequest
): Promise<QuestionBankDto> {
  const tagsValue = Array.isArray(req.tags)
    ? req.tags.join(",")
    : req.tags ?? "";

  const body = {
    bankName: req.bankName,
    description: req.description ?? null,
    category: req.category ?? null,
    tags: tagsValue,
    workspaceId: req.workspaceId ?? null,
    mapId: req.mapId ?? null,
    isTemplate: req.isTemplate ?? false,
    isPublic: req.isPublic ?? false,
  };

  const res = await postJson<typeof body, QuestionBankDto>(
    "/api/question-banks",
    body
  );
  return normalizeQuestionBank(res);
}

export async function getQuestionBank(
  questionBankId: string
): Promise<QuestionBankDto> {
  const res = await getJson<QuestionBankDto>(
    `/api/question-banks/${questionBankId}`
  );
  return normalizeQuestionBank(res);
}

export async function deleteQuestionBank(questionBankId: string) {
  return delJson(`/api/question-banks/${questionBankId}`);
}

export async function getMyQuestionBanks(): Promise<QuestionBankDto[]> {
  const res = await getJson<QuestionBanksEnvelope | QuestionBankDto[]>(
    "/api/question-banks/my"
  );
  return asQuestionBanks(res);
}

export async function getPublicQuestionBanks(): Promise<QuestionBankDto[]> {
  const res = await getJson<QuestionBanksEnvelope | QuestionBankDto[]>(
    "/api/question-banks/public"
  );
  return asQuestionBanks(res);
}

export interface UpdateTagsRequest {
  tags: string[];
}

export async function addTagsToQuestionBank(
  questionBankId: string,
  req: UpdateTagsRequest
): Promise<QuestionBankDto> {
  const body = {
    tags: req.tags,
  };

  const res = await postJson<typeof body, QuestionBankDto>(
    `/api/question-banks/${questionBankId}/tags`,
    body
  );
  return normalizeQuestionBank(res);
}

export async function updateTagsOfQuestionBank(
  questionBankId: string,
  req: UpdateTagsRequest
): Promise<QuestionBankDto> {
  const body = {
    tags: req.tags,
  };

  const res = await putJson<typeof body, QuestionBankDto>(
    `/api/question-banks/${questionBankId}/tags`,
    body
  );
  return normalizeQuestionBank(res);
}

function normalizeQuestion(raw: any): QuestionDto {
  if (!raw) {
    return {
      id: "",
      questionBankId: "",
      locationId: null,
      questionType: "",
      questionText: "",
      questionImageUrl: null,
      questionAudioUrl: null,
      points: 0,
      timeLimit: null,
      correctAnswerText: null,
      correctLatitude: null,
      correctLongitude: null,
      acceptanceRadiusMeters: null,
      hintText: null,
      explanation: null,
      displayOrder: 0,
      options: [],
    };
  }

  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];

  return {
    id: String(raw.id ?? raw.questionId ?? raw.questionID ?? raw.QuestionId ?? ""),
    questionBankId: String(
      raw.questionBankId ?? raw.QuestionBankId ?? raw.questionBankID ?? ""
    ),
    locationId: raw.locationId ?? null,
    questionType: raw.questionType ?? "",
    questionText: raw.questionText ?? "",
    questionImageUrl: raw.questionImageUrl ?? null,
    questionAudioUrl: raw.questionAudioUrl ?? null,
    points: typeof raw.points === "number" ? raw.points : 0,
    timeLimit: typeof raw.timeLimit === "number" ? raw.timeLimit : null,
    correctAnswerText: raw.correctAnswerText ?? null,
    correctLatitude:
      typeof raw.correctLatitude === "number" ? raw.correctLatitude : null,
    correctLongitude:
      typeof raw.correctLongitude === "number" ? raw.correctLongitude : null,
    acceptanceRadiusMeters:
      typeof raw.acceptanceRadiusMeters === "number"
        ? raw.acceptanceRadiusMeters
        : null,
    hintText: raw.hintText ?? null,
    explanation: raw.explanation ?? null,
    displayOrder: typeof raw.displayOrder === "number" ? raw.displayOrder : 0,
    options: optionsRaw.map((opt: any) => ({
      id: String(
        opt.id ?? opt.questionOptionId ?? opt.QuestionOptionId ?? ""
      ),
      optionText: opt.optionText ?? "",
      optionImageUrl: opt.optionImageUrl ?? null,
      isCorrect: !!opt.isCorrect,
      displayOrder:
        typeof opt.displayOrder === "number" ? opt.displayOrder : 0,
    })),
  };
}

export interface CreateQuestionRequest {
  questionBankId: string;
  locationId?: string | null;
  questionType: string;
  questionText: string;
  questionImageUrl?: string | null;
  questionAudioUrl?: string | null;
  points?: number;
  timeLimit?: number | null;
  correctAnswerText?: string | null;
  correctLatitude?: number | null;
  correctLongitude?: number | null;
  acceptanceRadiusMeters?: number | null;
  hintText?: string | null;
  explanation?: string | null;
  displayOrder: number;
  options?: QuestionOptionDto[];
}

export async function createQuestion(
  questionBankId: string,
  req: CreateQuestionRequest
): Promise<QuestionDto> {
  const body: CreateQuestionRequest = {
    ...req,
    questionBankId,
  };

  const res = await postJson<typeof body, any>(
    `/api/question-banks/${questionBankId}/questions`,
    body
  );
  return normalizeQuestion(res);
}

export async function getQuestionsOfQuestionBank(
  questionBankId: string
): Promise<QuestionDto[]> {
  const res = await getJson<any[]>(
    `/api/question-banks/${questionBankId}/questions`
  );
  const list = Array.isArray(res) ? res : [];
  return list.map(normalizeQuestion);
}

export async function deleteQuestion(questionId: string) {
  return delJson(`/api/question-banks/questions/${questionId}`);
}

// ======================= SESSIONS =======================

// Trạng thái session
export type SessionStatus = "Pending" | "Running" | "Paused" | "Ended" | string;

export interface SessionDto {
  id: string;

  // Map & question bank
  mapId?: string | null;
  mapName?: string | null;
  questionBankId?: string | null;
  questionBankName?: string | null;

  // Thông tin session
  sessionCode: string;
  sessionName?: string | null;
  description?: string | null;
  sessionType?: string;

  status: SessionStatus;

  // Thời gian & thống kê
  createdAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  totalParticipants?: number | null;
}
type SessionsEnvelope = { sessions: any[] };

function normalizeSession(raw: any): SessionDto {
  if (!raw) {
    return {
      id: "",
      mapId: null,
      mapName: null,
      questionBankId: null,
      questionBankName: null,
      sessionCode: "",
      sessionName: null,
      description: null,
      sessionType: null,
      status: "Pending",
      createdAt: null,
      startedAt: null,
      endedAt: null,
      totalParticipants: 0,
    };
  }

  return {
    id: raw.id ?? raw.sessionId ?? raw.SessionId ?? "",

    mapId: raw.mapId ?? raw.MapId ?? null,
    mapName: raw.mapName ?? raw.MapName ?? null,

    questionBankId: raw.questionBankId ?? raw.QuestionBankId ?? null,
    questionBankName:
      raw.questionBankName ?? raw.QuestionBankName ?? null,

    sessionCode: raw.sessionCode ?? raw.code ?? raw.SessionCode ?? "",
    sessionName: raw.sessionName ?? raw.SessionName ?? null,
    description: raw.description ?? raw.Description ?? null,
    sessionType: raw.sessionType ?? raw.SessionType ?? null,

    status: (raw.status ?? raw.Status ?? "Pending") as SessionStatus,

    createdAt: raw.createdAt ?? raw.CreatedAt ?? null,
    startedAt: raw.startedAt ?? raw.StartedAt ?? null,
    endedAt: raw.endedAt ?? raw.EndedAt ?? null,
    totalParticipants:
      raw.totalParticipants ??
      raw.TotalParticipants ??
      raw.participantCount ??
      null,
  };
}

function asSessions(res: SessionsEnvelope | any[]): SessionDto[] {
  const list = Array.isArray(res) ? res : res.sessions ?? [];
  return list.map(normalizeSession);
}

export interface CreateSessionRequest {
  mapId: string;
  questionBankId?: string;
  sessionName?: string;
  description?: string | null;
  sessionType?: "live" | "practice" | string;
  maxParticipants?: number;
  allowLateJoin?: boolean;
  showLeaderboard?: boolean;
  showCorrectAnswers?: boolean;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  enableHints?: boolean;
  pointsForSpeed?: boolean;
  scheduledStartTime?: string | null;
}

export async function createSession(
  req: CreateSessionRequest
): Promise<SessionDto> {
  const nowIso = new Date().toISOString();

  const baseBody = {
    mapId: req.mapId,
    sessionName: req.sessionName ?? "New session",
    description: req.description ?? null,
    sessionType: req.sessionType ?? "live",
    maxParticipants: req.maxParticipants ?? 0,
    allowLateJoin: req.allowLateJoin ?? true,
    showLeaderboard: req.showLeaderboard ?? true,
    showCorrectAnswers: req.showCorrectAnswers ?? true,
    shuffleQuestions: req.shuffleQuestions ?? true,
    shuffleOptions: req.shuffleOptions ?? true,
    enableHints: req.enableHints ?? true,
    pointsForSpeed: req.pointsForSpeed ?? true,
    scheduledStartTime: req.scheduledStartTime ?? nowIso,
  };

  const body: typeof baseBody & { questionBankId?: string } = {
    ...baseBody,
    ...(req.questionBankId ? { questionBankId: req.questionBankId } : {}),
  };

  const res = await postJson<typeof body, SessionDto>("/api/sessions", body);
  return normalizeSession(res as any);
}


export async function getSession(sessionId: string): Promise<SessionDto> {
  const res = await getJson<SessionDto>(`/api/sessions/${sessionId}`);
  return normalizeSession(res as any);
}

export async function deleteSession(sessionId: string) {
  return delJson(`/api/sessions/${sessionId}`);
}

export async function getMySessions(): Promise<SessionDto[]> {
  const res = await getJson<SessionsEnvelope | any[]>("/api/sessions/my");
  return asSessions(res as any);
}

export async function getSessionByCode(
  sessionCode: string
): Promise<SessionDto> {
  const res = await getJson<SessionDto>(
    `/api/sessions/code/${encodeURIComponent(sessionCode)}`
  );
  return normalizeSession(res as any);
}

// ---------- Thông tin người tham gia & join / leave ----------

export interface ParticipantDto {
  id: string;
  sessionId: string;
  displayName: string;
  score?: number;
}

function normalizeParticipant(raw: any): ParticipantDto {
  if (!raw) {
    return {
      id: "",
      sessionId: "",
      displayName: "",
      score: 0,
    };
  }

  const sessionId =
    raw.sessionId ??
    raw.SessionId ??
    raw.sessionID ??
    raw.session?.id ??
    "";

  return {
    id:
      raw.id ??
      raw.participantId ??
      raw.ParticipantId ??
      raw.participantID ??
      "",

    sessionId,

    displayName:
      raw.displayName ??
      raw.DisplayName ??
      raw.name ??
      raw.Name ??
      "",

    score:
      raw.score ??
      raw.Score ??
      raw.totalScore ??
      raw.TotalScore ??
      undefined,
  };
}

export interface JoinSessionRequest {
  sessionCode: string;
  displayName: string;
  deviceInfo?: string;
}

export async function joinSession(
  req: JoinSessionRequest
): Promise<ParticipantDto> {
  const body = {
    sessionCode: req.sessionCode,
    displayName: req.displayName,
    deviceInfo:
      req.deviceInfo ??
      (typeof navigator !== "undefined" ? navigator.userAgent : "unknown"),
  };

  const res = await postJson<typeof body, any>("/api/sessions/join", body);

  return normalizeParticipant(res);
}

export async function leaveSession(participantId: string) {
  await postJson<Record<string, never>, void>(
    `/api/sessions/participants/${participantId}/leave`,
    {}
  );
}

// ---------- Leaderboard ----------

export interface LeaderboardEntryDto {
  participantId: string;
  displayName: string;
  score: number;
  rank?: number;
}

export interface LeaderboardEntryDto {
  participantId: string;
  displayName: string;
  score: number;
  rank?: number;
}

export interface SessionLeaderboardResponse {
  sessionId: string;
  leaderboard: LeaderboardEntryDto[];
  updatedAt: string;
}

export async function getSessionLeaderboard(
  sessionId: string,
  limit = 10
): Promise<LeaderboardEntryDto[]> {
  const query = limit ? `?limit=${limit}` : "";

  const res = await getJson<
    SessionLeaderboardResponse | LeaderboardEntryDto[]
  >(`/api/sessions/${sessionId}/leaderboard${query}`);

  if (Array.isArray(res)) {
    return res;
  }

  if (
    res &&
    typeof res === "object" &&
    Array.isArray((res as any).leaderboard)
  ) {
    return (res as any).leaderboard as LeaderboardEntryDto[];
  }

  return [];
}

// ---------- Điều khiển session (GV) ----------

export async function startSession(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/api/sessions/${sessionId}/start`,
    {}
  );
}

export async function pauseSession(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/api/sessions/${sessionId}/pause`,
    {}
  );
}

export async function resumeSession(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/api/sessions/${sessionId}/resume`,
    {}
  );
}

export async function endSession(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/api/sessions/${sessionId}/end`,
    {}
  );
}

// ---------- Điều khiển câu hỏi trong session (GV) ----------

export async function goToNextQuestion(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/api/sessions/${sessionId}/questions/next`,
    {}
  );
}

export async function skipCurrentQuestion(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/api/sessions/${sessionId}/questions/skip`,
    {}
  );
}

export async function extendCurrentQuestion(
  sessionQuestionId: string,
  additionalSeconds: number
) {
  await postJson<Record<string, never>, void>(
    `/api/sessions/questions/${sessionQuestionId}/extend?additionalSeconds=${additionalSeconds}`,
    {}
  );
}

// ---------- Câu hỏi đang hiển thị cho học sinh ----------

export interface SessionRunningQuestionDto {
  sessionId: string;
  sessionQuestionId: string;
  questionId: string;
  questionType: string;
  questionText: string;
  questionImageUrl?: string | null;
  questionAudioUrl?: string | null;
  points?: number;
  timeLimit?: number | null;
  secondsRemaining?: number | null;
  options: QuestionOptionDto[];
}

export async function getCurrentQuestionForParticipant(
  participantId: string
): Promise<SessionRunningQuestionDto | null> {
  const res = await getJson<SessionRunningQuestionDto | null>(
    `/api/sessions/participants/${participantId}/current-question`
  );

  if (!res) return null;

  const opts = Array.isArray((res as any).options)
    ? (res as any).options.map((o: any, idx: number): QuestionOptionDto => ({
        id: o.id ?? o.optionId ?? o.questionOptionId ?? undefined,
        optionText: o.optionText ?? o.text ?? "",
        optionImageUrl: o.optionImageUrl ?? o.imageUrl ?? null,
        isCorrect: !!(o.isCorrect ?? o.correct ?? false),
        displayOrder: o.displayOrder ?? idx + 1,
      }))
    : [];

  return {
    ...res,
    options: opts,
  };
}

// ---------- Học sinh gửi đáp án ----------

export interface SubmitResponseRequest {
  sessionQuestionId: string;
  questionOptionId?: string;
  responseText?: string | null;
  responseLatitude?: number;
  responseLongitude?: number;
  responseTimeSeconds?: number;
  usedHint?: boolean;
}

export async function submitParticipantResponse(
  participantId: string,
  req: SubmitResponseRequest
) {
  const body = {
    sessionQuestionId: req.sessionQuestionId,
    questionOptionId: req.questionOptionId ?? null,
    responseText: req.responseText ?? null,
    responseLatitude: req.responseLatitude ?? 0,
    responseLongitude: req.responseLongitude ?? 0,
    responseTimeSeconds: req.responseTimeSeconds ?? 0,
    usedHint: req.usedHint ?? false,
  };

  await postJson<typeof body, void>(
    `/api/sessions/participants/${participantId}/responses`,
    body
  );
}
