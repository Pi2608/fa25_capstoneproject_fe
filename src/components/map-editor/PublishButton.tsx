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
    <div className="relative">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <span
          className={`px-3 py-1.5 rounded-md text-xs font-semibold ${statusInfo.color} text-white`}
        >
          {statusInfo.icon} {statusInfo.label}
        </span>

        {/* Action Buttons */}
        {status === "Draft" || status === "Unpublished" ? (
          <button
            onClick={handlePublish}
            disabled={loading}
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Publish"}
          </button>
        ) : status === "Published" ? (
          <div className="flex gap-2">
            <button
              onClick={handleUnpublish}
              disabled={loading}
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50"
            >
              Unpublish
            </button>
            <button
              onClick={handleArchive}
              disabled={loading}
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
            >
              Archive
            </button>
          </div>
        ) : status === "Archived" ? (
          <button
            onClick={handleRestore}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            Restore
          </button>
        ) : null}
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 rounded-md bg-red-900 text-red-100 text-xs max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
}

