export interface QuotaErrorInfo {
  type: "maps" | "exports" | "users";
  current: number;
  limit: number;
  message: string;
}

export function parseQuotaError(error: any): QuotaErrorInfo | null {
  // Extract error details from different possible formats
  // Support both direct error object and axios-style error.response.data
  const errorType = 
    error?.type || 
    error?.title || 
    error?.response?.data?.type || 
    error?.response?.data?.title || 
    "";
  
  const detail = 
    error?.detail || 
    error?.message || 
    error?.response?.data?.detail || 
    error?.response?.data?.message || 
    "";

  // Check if this is a quota error - check both type/title and message content
  const isQuotaError = 
    errorType.includes("QuotaExceeded") ||
    errorType.includes("UserQuotaExceeded") ||
    (typeof detail === "string" && (
      detail.toLowerCase().includes("quota exceeded") ||
      detail.toLowerCase().includes("quota limit") ||
      detail.toLowerCase().includes("organization is now full") ||
      detail.toLowerCase().includes("member slots are occupied") ||
      (detail.toLowerCase().includes("maximum") && detail.toLowerCase().includes("limit"))
    ));

  if (!isQuotaError) {
    return null;
  }

  // Determine quota type from error type or message
  let quotaType: "maps" | "exports" | "users" = "maps";
  if (errorType.includes("Map")) {
    quotaType = "maps";
  } else if (errorType.includes("Export")) {
    quotaType = "exports";
  } else if (errorType.includes("User") || errorType.includes("Member") || 
             (typeof detail === "string" && (detail.toLowerCase().includes("member") || detail.toLowerCase().includes("user")))) {
    quotaType = "users";
  }

  // Parse the detail message to extract numbers
  // Pattern 1: "Quota exceeded. You have 5/5 Maps used. Requested: 1"
  let match = detail.match(/You have (\d+)\/(\d+) (\w+) used/);
  
  // Pattern 2: "Organization is now full - all {limit} member slots are occupied"
  if (!match && typeof detail === "string") {
    match = detail.match(/all (\d+) (?:member|user) slots? (?:are|is) occupied/i);
    if (match) {
      // For this pattern, current = limit (all slots are full)
      return {
        type: "users",
        current: parseInt(match[1], 10),
        limit: parseInt(match[1], 10),
        message: detail || "Quota exceeded",
      };
    }
  }

  // Pattern 3: Extract numbers from "X/Y" format anywhere in the message
  if (!match && typeof detail === "string") {
    match = detail.match(/(\d+)\/(\d+)/);
  }

  if (!match) {
    // If we can't parse numbers, return basic info with detected type
    return {
      type: quotaType,
      current: 0,
      limit: 0,
      message: detail || "Quota exceeded",
    };
  }

  const current = parseInt(match[1], 10);
  const limit = parseInt(match[2], 10);
  
  // If we have a third match group, use it to determine type, otherwise use already determined type
  if (match[3]) {
    const resourceType = match[3].toLowerCase();
    if (resourceType.includes("export")) {
      quotaType = "exports";
    } else if (resourceType.includes("user") || resourceType.includes("member")) {
      quotaType = "users";
    } else if (resourceType.includes("map")) {
      quotaType = "maps";
    }
  }

  return {
    type: quotaType,
    current,
    limit,
    message: detail,
  };
}
