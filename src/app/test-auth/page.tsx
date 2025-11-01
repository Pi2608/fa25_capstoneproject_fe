"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/lib/api-core";
import { useEffect, useState } from "react";

export default function TestAuthPage() {
  const { token, isLoggedIn, userEmail, userId } = useAuth();
  const [localStorageToken, setLocalStorageToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLocalStorageToken(localStorage.getItem("token"));
    }
  }, []);

  const refreshTokenInfo = () => {
    if (typeof window !== "undefined") {
      setLocalStorageToken(localStorage.getItem("token"));
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Auth Debug Information</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">AuthContext State:</h2>
          <p><strong>isLoggedIn:</strong> {isLoggedIn ? "true" : "false"}</p>
          <p><strong>userEmail:</strong> {userEmail || "null"}</p>
          <p><strong>userId:</strong> {userId || "null"}</p>
          <p><strong>token:</strong> {token ? `${token.substring(0, 20)}...` : "null"}</p>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">LocalStorage Direct:</h2>
          <p><strong>token:</strong> {localStorageToken ? `${localStorageToken.substring(0, 20)}...` : "null"}</p>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">API Core getToken():</h2>
          <p><strong>token:</strong> {getToken() ? `${getToken()!.substring(0, 20)}...` : "null"}</p>
        </div>

        <button 
          onClick={refreshTokenInfo}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Token Info
        </button>
      </div>
    </div>
  );
}