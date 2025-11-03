import { getJson } from "./api-core";

export type HomeStatsResponse = {
  organizationCount: number;
  templateCount: number;
  totalMaps: number;
  monthlyExports: number;
};

export function getHomeStats() {
  return getJson<HomeStatsResponse>("/home/stats");
}
