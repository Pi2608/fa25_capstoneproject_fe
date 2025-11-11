import * as signalR from "@microsoft/signalr";
import { getToken } from "./api-core";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function isTokenValid(token: string): boolean {
  if (!token || token.trim().length === 0) {
    return false;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return false;
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp = payload.exp;
    
    if (!exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return exp > now;
  } catch {
    return false;
  }
}

function getConnectionState(connection: signalR.HubConnection): signalR.HubConnectionState {
  return connection.state;
}

export function createNotificationConnection(token: string): signalR.HubConnection | null {
  if (!API_BASE_URL) {
    return null;
  }

  if (!token || !token.trim()) {
    return null;
  }

  if (!isTokenValid(token)) {
    return null;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const hubUrl = `${baseUrl}/hubs/notifications`;
  
   
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: async () => {
        const currentToken = getToken();
        if (!currentToken) {
          throw new Error("No token available");
        }
        if (!isTokenValid(currentToken)) {
          throw new Error("Token is invalid or expired");
        }
        return currentToken;
      },
      withCredentials: true,
      skipNegotiation: false,
      transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
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

  connection.onclose((error) => {
    if (error) {
      const currentToken = getToken();
      if (!currentToken || !isTokenValid(currentToken)) {
        return;
      }
    } else {
    }
  });

  return connection;
}

export async function startConnection(connection: signalR.HubConnection, token: string): Promise<boolean> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      return true;
    }

    const initialState = connection.state;
    if (initialState !== signalR.HubConnectionState.Disconnected) {
       return false;
    }

    const currentToken = getToken();
    if (!currentToken || currentToken !== token) {
      return false;
    }

    if (!isTokenValid(currentToken)) {
     return false;
    }

    try {
      await connection.start();
    } catch (startError) {
      throw startError;
    }
    
    const stateAfterStart = getConnectionState(connection);
    
    if (stateAfterStart === signalR.HubConnectionState.Connected) {
      return true;
    }
    
    return false;
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes("negotiation") || errorMessage.includes("abort")) { 
      } else {
        console.error("[SignalR] Failed to start connection:", error);
      }
    }
    return false;
  }
}

export async function stopConnection(connection: signalR.HubConnection): Promise<void> {
  try {
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (error) {
    console.error("Failed to stop SignalR connection:", error);
  }
}