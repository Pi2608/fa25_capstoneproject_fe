"use client";

import { archiveMap, MapStatus, publishMap, restoreMap, unpublishMap } from "@/lib/api-maps";
import { useState } from "react";

interface PublishButtonProps {
  mapId: string;
  status: MapStatus;
  onStatusChange: (newStatus: MapStatus) => void;
}

export default function PublishButton({ mapId, status, onStatusChange }: PublishButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setLoading(true);
    setError(null);
    try {
      await publishMap(mapId);
      onStatusChange("Published");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể publish map");
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setLoading(true);
    setError(null);
    try {
      await unpublishMap(mapId);
      onStatusChange("Unpublished");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể unpublish map");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    setError(null);
    try {
      await archiveMap(mapId);
      onStatusChange("Archived");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể archive map");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    setError(null);
    try {
      await restoreMap(mapId);
      onStatusChange("Draft");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể restore map");
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = () => {
    switch (status) {
      case "Draft":
        return { label: "Nháp", color: "bg-gray-600", icon: "📝" };
      case "UnderReview":
        return { label: "Đang xem xét", color: "bg-yellow-600", icon: "👀" };
      case "Published":
        return { label: "Đã publish", color: "bg-green-600", icon: "✓" };
      case "Unpublished":
        return { label: "Đã unpublish", color: "bg-orange-600", icon: "⊘" };
      case "Archived":
        return { label: "Đã archive", color: "bg-red-600", icon: "🗄️" };
      default:
        return { label: "Unknown", color: "bg-gray-600", icon: "?" };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="relative flex items-center gap-0">
      {/* Compact Status Badge */}
      <span
        className={`px-2.5 py-1.5 rounded-md text-xs font-medium ${statusInfo.color} text-white flex items-center gap-1.5`}
      >
        <span>{statusInfo.icon}</span>
        <span>{statusInfo.label}</span>
      </span>

      {/* Action Buttons - Inline with status */}
      {status === "Draft" || status === "Unpublished" ? (
        <button
          onClick={handlePublish}
          disabled={loading}
          className="rounded-md px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 ml-0.5"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Publish</span>
            </>
          )}
        </button>
      ) : status === "Published" ? (
        <>
          <button
            onClick={handleUnpublish}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 ml-0.5"
            title="Unpublish this map"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Unpublish</span>
              </>
            )}
          </button>
          <button
            onClick={handleArchive}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            title="Archive this map"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span>Archive</span>
              </>
            )}
          </button>
        </>
      ) : status === "Archived" ? (
        <button
          onClick={handleRestore}
          disabled={loading}
          className="rounded-md px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 ml-0.5"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Restore</span>
            </>
          )}
        </button>
      ) : null}

      {/* Error Message */}
      {error && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 rounded-md bg-red-900 text-red-100 text-xs max-w-xs z-50 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

