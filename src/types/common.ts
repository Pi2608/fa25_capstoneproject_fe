// Common types used across multiple components/modules

export type BaseKey = 
  | "osm"           // OpenStreetMap (default)
  | "sat"           // Satellite/Imagery
  | "dark"          // CartoDB Dark
  | "positron"      // CartoDB Positron (light)
  | "dark-matter"   // CartoDB Dark Matter
  | "terrain"       // Stamen Terrain
  | "toner"         // Stamen Toner
  | "watercolor"    // Stamen Watercolor
  | "topo";         // OpenTopoMap

export type ViewMode = "grid" | "list";

export type SortOrder = "asc" | "desc";

export type SortKey = 
  | "recentlyModified" 
  | "dateCreated" 
  | "lastViewed" 
  | "name" 
  | "author"
  | "popular"
  | "newest"
  | "likes";

// API Error types
export interface ApiError {
  message?: string;
  status?: number;
  detail?: string;
}

export interface ApiLikeError {
  status?: number;
  message?: string;
  detail?: string;
}

// Membership types
export type MembershipStatus = "active" | "expired" | "pending" | string;

export interface MyMembership {
  planId: number;
  status: MembershipStatus;
}

// Status badge types
export type BadgeVariant = "active" | "pending" | "expired" | "info" | "warning" | "error";

// Pagination types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Search params
export type SearchParams = Record<string, string | string[] | undefined>;

// Common utility types
export type Primitive = string | number | boolean | null;

export type UnknownObj = Record<string, unknown>;

export type PropsRecord = Record<string, unknown>;

export type PropType = "string" | "number" | "boolean" | "object" | "undefined";
