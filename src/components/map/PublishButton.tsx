"use client";

import { archiveMap, MapStatus, publishMap, restoreMap, unpublishMap } from "@/lib/api-maps";
import { ArchiveIcon, RefreshCcwIcon, SendIcon, UndoIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface PublishButtonProps {
  mapId: string;
  status: MapStatus;
  onStatusChange: (newStatus: MapStatus) => void;
}

export default function PublishButton({ mapId, status, onStatusChange }: PublishButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPublishOptions, setShowPublishOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPublishOptions(false);
      }
    };

    if (showPublishOptions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPublishOptions]);

  const handlePublish = async (_isStoryMap: boolean) => {
    setLoading(true);
    setError(null);
    setShowPublishOptions(false);
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
      onStatusChange("Draft");
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
      case "Published":
        return { label: "Đã publish", color: "bg-green-600", icon: "✓" };
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
      {status === "Draft" ? (
        <div className="relative flex items-center gap-1" ref={dropdownRef}>
          {/* Primary quick publish (view-only) */}
          <button
            onClick={() => handlePublish(false)}
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
                <SendIcon className="w-3.5 h-3.5" />
                <span>Publish</span>
              </>
            )}
          </button>

          {showPublishOptions && !loading && (
            <div className="absolute top-full right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-50 min-w-[240px]">
              <div className="py-1">
                <button
                  onClick={() => handlePublish(true)}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 flex items-start gap-2"
                >
                  <div className="flex-1">
                    <div className="font-medium">Publish thành Storymap</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Có thể tạo session từ bản đồ này</div>
                  </div>
                </button>
                <button
                  onClick={() => handlePublish(false)}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 flex items-start gap-2"
                >
                  <div className="flex-1">
                    <div className="font-medium">Publish để xem</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Chỉ để xem, không thể tạo session</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
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
                <UndoIcon className="w-3.5 h-3.5" />
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
                <ArchiveIcon className="w-3.5 h-3.5" />
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
              <RefreshCcwIcon className="w-3.5 h-3.5" />
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

