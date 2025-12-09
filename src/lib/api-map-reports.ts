import { postJson, getJson } from "./api-core";

export type MapReportReason = 
  | "inappropriate_content"
  | "copyright_violation"
  | "spam"
  | "misinformation"
  | "harassment"
  | "other";

export type MapReportStatus = 
  | "Pending"
  | "UnderReview"
  | "Resolved"
  | "Dismissed"
  | "ActionTaken";

export type MapReport = {
  reportId: string;
  mapId: string;
  mapName?: string;
  reporterUserId?: string;
  reporterEmail: string;
  reporterName: string;
  reason: string;
  description?: string;
  status: number;
  statusLabel: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ReportMapRequest = {
  mapId: string;
  reason: string;
  description?: string;
  reporterEmail?: string;
  reporterName?: string;
};

export type ReviewReportRequest = {
  status: number;
  reviewNotes?: string;
  shouldDeleteMap?: boolean;
};

export type MapReportListResponse = {
  reports: MapReport[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function reportMap(request: ReportMapRequest): Promise<MapReport> {
  return await postJson<ReportMapRequest, MapReport>("/maps/reports", request);
}

export async function getMapReports(page: number = 1, pageSize: number = 20): Promise<MapReportListResponse> {
  return await getJson<MapReportListResponse>(`/maps/reports?page=${page}&pageSize=${pageSize}`);
}

export async function getMapReportsByStatus(status: number, page: number = 1, pageSize: number = 20): Promise<MapReportListResponse> {
  return await getJson<MapReportListResponse>(`/maps/reports/status/${status}?page=${page}&pageSize=${pageSize}`);
}

export async function getMapReportById(reportId: string): Promise<MapReport> {
  return await getJson<MapReport>(`/maps/reports/${reportId}`);
}

export async function reviewMapReport(reportId: string, request: ReviewReportRequest): Promise<MapReport> {
  return await postJson<ReviewReportRequest, MapReport>(`/maps/reports/${reportId}/review`, request);
}

export async function getPendingReportsCount(): Promise<{ count: number }> {
  return await getJson<{ count: number }>("/maps/reports/pending/count");
}

