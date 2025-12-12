// ===================== SESSION TYPES =====================

export type SessionStatus = "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";

export type QuestionType =
  | "MultipleChoice"
  | "TrueFalse"
  | "ShortAnswer"
  | "WordCloud"
  | "PinOnMap";

export interface Session {
  id: string;
  mapId?: string | null;
  questionBankId?: string | null;
  sessionCode: string;
  sessionName?: string;
  status: SessionStatus;
  createdAt?: string;
  startedAt?: string | null;
  endedAt?: string | null;
  totalParticipants?: number;
  currentQuestionIndex?: number;
  totalQuestions?: number;
}

export interface Participant {
  id: string;
  sessionId: string;
  displayName: string;
  score: number;
  isTeacher?: boolean;
  joinedAt?: string;
}

export interface SessionQuestion {
  id: string; // sessionQuestionId
  questionId: string;
  sessionId: string;
  questionType: QuestionType;
  questionText: string;
  questionImageUrl?: string | null;
  questionAudioUrl?: string | null;
  options?: QuestionOption[];
  points: number;
  timeLimit: number;
  hintText?: string | null;
  explanation?: string | null;
  correctAnswerText?: string | null;
  correctLatitude?: number | null;
  correctLongitude?: number | null;
  acceptanceRadiusMeters?: number | null;
  displayOrder: number;
  activatedAt?: string | null;
  endedAt?: string | null;
}

export interface QuestionOption {
  id: string;
  optionText: string;
  optionImageUrl?: string | null;
  isCorrect?: boolean;
  displayOrder: number;
}

export interface ParticipantResponse {
  id: string;
  participantId: string;
  sessionQuestionId: string;
  questionOptionId?: string | null;
  responseText?: string | null;
  responseLatitude?: number | null;
  responseLongitude?: number | null;
  responseTimeSeconds: number;
  isCorrect: boolean;
  pointsAwarded: number;
  usedHint: boolean;
  submittedAt: string;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  score: number;
  rank: number;
  accuracy?: number;
  averageResponseTime?: number;
}

// ===================== ANALYTICS TYPES =====================

export interface WordCloudData {
  word: string;
  frequency: number;
  size?: number;
}

export interface MapPinData {
  participantId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  isCorrect: boolean;
}

export interface SessionResults {
  sessionId: string;
  sessionName: string;
  totalQuestions: number;
  totalParticipants: number;
  leaderboard: LeaderboardEntry[];
  averageScore: number;
  completionRate: number;
  startedAt: string;
  endedAt: string;
  duration: number; // in seconds
}

export interface QuestionResults {
  sessionQuestionId: string;
  questionText: string;
  questionType: QuestionType;
  totalResponses: number;
  correctResponses: number;
  incorrectResponses: number;
  averageResponseTime: number;
  correctnessRate: number;
  wordCloudData?: WordCloudData[];
  mapPinsData?: MapPinData[];
}

// ===================== UI STATE TYPES =====================

export interface SessionState {
  session: Session | null;
  currentQuestion: SessionQuestion | null;
  participant: Participant | null;
  leaderboard: LeaderboardEntry[];
  participants: Participant[];
  isLoading: boolean;
  error: string | null;
}

export interface TimerState {
  timeRemaining: number;
  timeLimit: number;
  isActive: boolean;
  isPaused: boolean;
  progress: number; // 0-100
}

export interface AnswerSubmission {
  sessionQuestionId: string;
  questionType: QuestionType;
  optionId?: string;
  textAnswer?: string;
  latitude?: number;
  longitude?: number;
  responseTime: number;
  usedHint: boolean;
}

export interface AnswerFeedback {
  isCorrect: boolean;
  pointsAwarded: number;
  speedBonus?: number;
  correctAnswer?: string;
  explanation?: string;
}

// ===================== TEACHER CONTROL TYPES =====================

export interface TeacherControlState {
  canActivateNext: boolean;
  canSkip: boolean;
  canExtendTime: boolean;
  canPause: boolean;
  canResume: boolean;
  canEnd: boolean;
  responsesReceived: number;
  totalParticipants: number;
}

export interface TeacherFocus {
  latitude: number;
  longitude: number;
  zoom: number;
}

// ===================== SESSION CONFIGURATION =====================

export interface SessionConfig {
  sessionName?: string;
  description?: string | null;
  sessionType?: "live" | "practice";
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

// ===================== STUDENT JOIN TYPES =====================

export interface JoinSessionData {
  sessionCode: string;
  displayName: string;
  deviceInfo?: string;
}

export interface JoinSessionResponse {
  participant: Participant;
  session: Session;
  waitingForStart: boolean;
}

