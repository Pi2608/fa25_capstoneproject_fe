import * as signalR from "@microsoft/signalr";
import { getToken } from "../api-core";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// ===================== SHARED UTILITIES =====================

/**
 * Check if a JWT token is valid (not expired)
 */
export function isTokenValid(token: string): boolean {
  if (!token || token.trim().length === 0) {
    return false;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return false;
    }

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const exp = payload.exp;

    if (!exp) {
      return true; // No expiration, consider valid
    }

    const now = Math.floor(Date.now() / 1000);
    return exp > now;
  } catch {
    return false;
  }
}

// ===================== BASE CONNECTION BUILDER =====================

export interface BaseConnectionOptions {
  token?: string;
  allowGuest?: boolean;
  onClose?: (error?: Error) => void;
  onReconnecting?: (error?: Error) => void;
  onReconnected?: (connectionId?: string) => void;
}

/**
 * Create a base SignalR connection with common configuration
 */
export function createBaseConnection(
  hubUrl: string,
  options: BaseConnectionOptions = {}
): signalR.HubConnection {
  const {
    token,
    allowGuest = false,
    onClose,
    onReconnecting,
    onReconnected,
  } = options;

  const authToken = token || (allowGuest ? undefined : getToken());

  const connectionBuilder = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: async () => {
        if (!authToken && !allowGuest) {
          throw new Error("No token available");
        }
        if (!authToken) {
          return ""; // Guest mode - no token
        }
        const currentToken = getToken();
        if (!currentToken && authToken) {
          return authToken; // Fallback to provided token
        }
        if (!currentToken) {
          if (allowGuest) return "";
          throw new Error("No token available");
        }
        if (!isTokenValid(currentToken)) {
          if (allowGuest) return "";
          throw new Error("Token is invalid or expired");
        }
        return currentToken;
      },
      withCredentials: true,
      skipNegotiation: false,
      transport:
        signalR.HttpTransportType.WebSockets |
        signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (retryContext) => {
        if (retryContext.previousRetryCount === 0) return 0;
        if (retryContext.previousRetryCount === 1) return 2000;
        if (retryContext.previousRetryCount === 2) return 10000;
        return 30000;
      },
    })
    .configureLogging(signalR.LogLevel.Information)
    .build();

  if (onClose) {
    connectionBuilder.onclose(onClose);
  }

  if (onReconnecting) {
    connectionBuilder.onreconnecting(onReconnecting);
  }

  if (onReconnected) {
    connectionBuilder.onreconnected(onReconnected);
  }

  return connectionBuilder;
}

