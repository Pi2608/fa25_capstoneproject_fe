import { getJson, postJson, putJson, delJson } from "./api-core";
import { getToken } from "./api-core";

export interface QuestionOptionDto {
  questionOptionId: string;
  questionId: string;
  optionText: string;
  optionImageUrl?: string | null;
  isCorrect: boolean;
  displayOrder: number;
}

export interface QuestionDto {
  sessionQuestionId: string;
  questionId: string;
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
  createdAt?: string;
  updatedAt?: string | null;
  options?: QuestionOptionDto[];
}

export interface QuestionBankDto {
  questionBankId: string;
  userId: string;
  bankName: string;
  description?: string | null;
  category?: string | null;
  tags?: string | string[];
  workspaceId?: string | null;
  isTemplate?: boolean;
  isPublic?: boolean;
  totalQuestions?: number;
  createdAt?: string;
  updatedAt?: string | null;
}


export interface CreateQuestionBankRequest {
  bankName: string;
  description?: string | null;
  category?: string | null;
  tags?: string[] | string;
  workspaceId?: string | null;
  isTemplate?: boolean;
  isPublic?: boolean;
}

export async function createQuestionBank(req: CreateQuestionBankRequest): Promise<QuestionBankDto> {
  const tagsValue = Array.isArray(req.tags)
    ? req.tags.join(",")
    : req.tags ?? "";

  const body = {
    workspaceId: req.workspaceId ?? null,
    bankName: req.bankName,
    description: req.description ?? null,
    category: req.category ?? null,
    tags: tagsValue,
    isTemplate: req.isTemplate ?? false,
    isPublic: req.isPublic ?? false,
  };

  const res = await postJson<typeof body, QuestionBankDto>(
    "/question-banks",
    body
  );
  return res;
}

export interface UpdateQuestionBankRequest {
  bankName?: string;
  description?: string | null;
  category?: string | null;
  tags?: string[] | string;
  workspaceId?: string | null;
  isTemplate?: boolean;
  isPublic?: boolean;
}

export async function updateQuestionBank(
  questionBankId: string,
  req: UpdateQuestionBankRequest
): Promise<QuestionBankDto> {
  const tagsValue = Array.isArray(req.tags)
    ? req.tags.join(",")
    : req.tags ?? "";

  const body = {
    workspaceId: req.workspaceId ?? null,
    bankName: req.bankName,
    description: req.description ?? null,
    category: req.category ?? null,
    tags: tagsValue,
    isTemplate: req.isTemplate ?? false,
    isPublic: req.isPublic ?? false,
  };

  const res = await putJson<typeof body, QuestionBankDto>(
    `/question-banks/${questionBankId}`,
    body
  );
  return res;
}

export async function attachMapToQuestionBank(
  questionBankId: string,
  mapId: string
): Promise<void> {
  const body = { mapId };
  await postJson<typeof body, void>(
    `/question-banks/${questionBankId}/maps`,
    body
  );
}

export async function getMapsByQuestionBank(
  questionBankId: string
): Promise<Array<{ mapId: string; mapName: string }>> {
  const res = await getJson<Array<{ mapId: string; mapName: string; assignedAt?: string }>>(
    `/question-banks/${questionBankId}/maps`
  );
  return res;
}

export async function getQuestionBank(
  questionBankId: string
): Promise<QuestionBankDto> {
  const res = await getJson<QuestionBankDto>(
    `/question-banks/${questionBankId}`
  );
  return res;
}

export async function deleteQuestionBank(questionBankId: string) {
  return delJson(`/question-banks/${questionBankId}`);
}

export async function getMyQuestionBanks(): Promise<QuestionBankDto[]> {
  const res = await getJson<QuestionBankDto[]>(
    "/question-banks/my"
  );
  return res;
}

export async function getPublicQuestionBanks(): Promise<QuestionBankDto[]> {
  const res = await getJson<QuestionBankDto[]>(
    "/question-banks/public"
  );
  return res;
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
    `/question-banks/${questionBankId}/tags`,
    body
  );
  return res;
}

export async function updateTagsOfQuestionBank(
  questionBankId: string,
  req: UpdateTagsRequest
): Promise<QuestionBankDto> {
  const body = {
    tags: req.tags,
  };

  const res = await putJson<typeof body, QuestionBankDto>(
    `/question-banks/${questionBankId}/tags`,
    body
  );
  return res;
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
  options?: CreateQuestionOptionRequest[];
}

export interface CreateQuestionOptionRequest {
  optionText: string;
  optionImageUrl?: string | null;
  isCorrect: boolean;
  displayOrder: number;
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
    `/question-banks/${questionBankId}/questions`,
    body
  );
  return res;
}

export async function getQuestionsOfQuestionBank(
  questionBankId: string
): Promise<QuestionDto[]> {
  const res = await getJson<QuestionDto[]>(
    `/question-banks/${questionBankId}/questions`

  );
  return res;
}

export async function deleteQuestion(questionId: string) {
  return delJson(`/question-banks/questions/${questionId}`);
}

export interface UpdateQuestionOptionRequest {
  optionText: string;
  optionImageUrl?: string | null;
  isCorrect: boolean;
  displayOrder: number;
}

// Update Question
export interface UpdateQuestionRequest {
  questionText: string;
  description?: string | null;
  questionType: string;
  points: number;
  timeLimit?: number | null;
  questionImageUrl?: string | null;
  questionAudioUrl?: string | null;
  options?: UpdateQuestionOptionRequest[];
  correctAnswerText?: string | null;
  correctLatitude?: number | null;
  correctLongitude?: number | null;
  acceptanceRadiusMeters?: number | null;
  hintText?: string | null;
  explanation?: string | null;
}

export async function updateQuestion(
  questionId: string,
  req: UpdateQuestionRequest
): Promise<QuestionDto> {
  const body = {
    questionText: req.questionText,
    description: req.description ?? null,
    questionType: req.questionType,
    points: req.points,
    timeLimit: req.timeLimit ?? null,
    questionImageUrl: req.questionImageUrl ?? null,
    questionAudioUrl: req.questionAudioUrl ?? null,
    options: req.options ?? [],
    correctAnswerText: req.correctAnswerText ?? null,
    correctLatitude: req.correctLatitude ?? null,
    correctLongitude: req.correctLongitude ?? null,
    acceptanceRadiusMeters: req.acceptanceRadiusMeters ?? null,
    hintText: req.hintText ?? null,
    explanation: req.explanation ?? null,
  };

  const res = await putJson<typeof body, QuestionDto>(
    `/question-banks/questions/${questionId}`,
    body
  );
  return res;
}

// ======================= SESSIONS =======================

// Trạng thái session
export type SessionStatus =
  | "WAITING"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | string;


export interface SessionDto {
  sessionId: string;

  // Map & question bank
  mapId?: string | null;
  mapName?: string | null;
  questionBankId?: string | null;
  questionBankName?: string | null;

  // Host
  hostUserId?: string | null;
  hostUserName?: string | null;

  // Thông tin session
  sessionCode: string;
  sessionName?: string | null;
  description?: string | null;
  sessionType?: string;

  status: SessionStatus;

  // Cấu hình
  maxParticipants?: number | null;
  allowLateJoin?: boolean;
  showLeaderboard?: boolean;
  showCorrectAnswers?: boolean;

  // Thời gian & thống kê
  createdAt?: string | null;
  scheduledStartTime?: string | null;
  actualStartTime?: string | null;
  endTime?: string | null;

  startedAt?: string | null;
  endedAt?: string | null;

  totalParticipants?: number | null;
  totalResponses?: number | null;
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
    questionBankId: req.questionBankId ?? null,
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

  const res = await postJson<typeof baseBody, SessionDto>("/sessions", baseBody);
  return res;
}


export async function getSession(sessionId: string): Promise<SessionDto> {
  const res = await getJson<SessionDto>(`/sessions/${sessionId}`);
  return res;
}

export async function deleteSession(sessionId: string) {
  return delJson(`/sessions/${sessionId}`);
}

export async function getMySessions(): Promise<SessionDto[]> {
  const res = await getJson<SessionDto[]>("/sessions/my");
  if (!Array.isArray(res)) return [];
  return res;
}

export async function getSessionByCode(
  sessionCode: string
): Promise<SessionDto> {
  const res = await getJson<SessionDto>(
    `/sessions/code/${encodeURIComponent(sessionCode)}`
  );
  return res;
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

  const res = await postJson<typeof body, ParticipantDto>(
    "/sessions/join",
    body
  );
  return res;
}

export async function leaveSession(participantId: string) {
  await postJson<Record<string, never>, void>(
    `/sessions/participants/${participantId}/leave`,
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
  >(`/sessions/${sessionId}/leaderboard${query}`);

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
    `/sessions/${sessionId}/start`,
    {}
  );
}

export async function pauseSession(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/sessions/${sessionId}/pause`,
    {}
  );
}

export async function resumeSession(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/sessions/${sessionId}/resume`,
    {}
  );
}

export async function endSession(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/sessions/${sessionId}/end`,
    {}
  );
}

// ---------- Điều khiển câu hỏi trong session (GV) ----------

export async function activateNextQuestion(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/sessions/${sessionId}/questions/next`,
    {}
  );
}

export async function skipCurrentQuestion(sessionId: string) {
  await postJson<Record<string, never>, void>(
    `/sessions/${sessionId}/questions/skip`,
    {}
  );
}

export async function extendQuestionTime(
  sessionQuestionId: string,
  additionalSeconds: number
) {
  const query = new URLSearchParams({
    additionalSeconds: String(additionalSeconds),
  }).toString();

  await postJson<Record<string, never>, void>(
    `/sessions/questions/${encodeURIComponent(sessionQuestionId)}/extend?${query}`,
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

// export async function getCurrentQuestionForParticipant(
//   participantId: string
// ): Promise<SessionRunningQuestionDto | null> {
//   const res = await getJson<SessionRunningQuestionDto | null>(
//     `/sessions/participants/${participantId}/current-question`
//   );

//   if (!res) return null;

//   const opts = Array.isArray((res as any).options)
//     ? (res as any).options.map((o: any, idx: number): QuestionOptionDto => ({
//       questionOptionId: o.questionOptionId ?? o.QuestionOptionId ?? "",
//       questionId: o.questionId ?? o.QuestionId ?? "",
//       optionText: o.optionText ?? o.text ?? "",
//       optionImageUrl: o.optionImageUrl ?? o.imageUrl ?? null,
//       isCorrect: !!(o.isCorrect ?? o.correct ?? false),
//       displayOrder: o.displayOrder ?? idx + 1,
//     }))
//     : [];

//   return {
//     ...res,
//     options: opts,
//   };
// }

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
    `/sessions/participants/${participantId}/responses`,
    body
  );
}

export interface WordCloudEntry {
  word: string;
  frequency: number;
  size?: number;
}

export interface MapPinEntry {
  participantId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  isCorrect: boolean;
}

// ---------- File Upload APIs ----------

export async function uploadQuestionImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");
  }

  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${base}/question-banks/questions/upload-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to upload image");
  }

  const data = await response.json();
  return data.imageUrl || data.audioUrl || "";
}

export async function uploadQuestionAudio(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");
  }

  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${base}/question-banks/questions/upload-audio`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to upload audio");
  }

  const data = await response.json();
  return data.audioUrl || data.imageUrl || "";
}

export async function uploadOptionImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");
  }

  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(
    `${base}/question-banks/questions/options/upload-image`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to upload option image");
  }

  const data = await response.json();
  return data.imageUrl || "";
}

// ---------- Analytics Endpoints ----------

// Word Cloud Data
export interface WordCloudEntryDto {
  word: string;
  count: number;
  frequency: number; // Percentage 0-100
}

export interface WordCloudDataDto {
  sessionQuestionId: string;
  entries: WordCloudEntryDto[];
  totalResponses: number;
}

export async function getWordCloudData(
  sessionQuestionId: string
): Promise<WordCloudDataDto> {
  const res = await getJson<WordCloudDataDto>(
    `/sessions/questions/${sessionQuestionId}/word-cloud`
  );
  return res;
}

// Map Pins Data
export interface MapPinEntryDto {
  participantId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  isCorrect: boolean;
  distanceFromCorrect: number; // in meters
  pointsEarned: number;
}

export interface MapPinsDataDto {
  sessionQuestionId: string;
  pins: MapPinEntryDto[];
  totalResponses: number;
  correctLatitude?: number | null;
  correctLongitude?: number | null;
  acceptanceRadiusMeters?: number | null;
}

export async function getMapPinsData(
  sessionQuestionId: string
): Promise<MapPinsDataDto> {
  const res = await getJson<MapPinsDataDto>(
    `/sessions/questions/${sessionQuestionId}/map-pins`
  );
  return res;
}

// NOTE: Teacher Focus sẽ được xử lý qua SignalR thay vì REST API
export interface TeacherFocusRequest {
  latitude: number;
  longitude: number;
  zoom: number;
}
