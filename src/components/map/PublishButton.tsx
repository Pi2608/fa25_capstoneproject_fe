"use client";

import { archiveMap, MapStatus, publishMap, restoreMap, unpublishMap } from "@/lib/api-maps";
import { ArchiveIcon, RefreshCcwIcon, SendIcon, UndoIcon, ExternalLinkIcon, ChevronDownIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

interface PublishButtonProps {
  mapId: string;
  status: MapStatus;
  onStatusChange: (newStatus: MapStatus) => void;
  isStoryMap?: boolean;
}

export default function PublishButton({ mapId, status, onStatusChange, isStoryMap = true }: PublishButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPublishOptions, setShowPublishOptions] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Calculate dropdown position
  useEffect(() => {
    if (showPublishOptions && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 4,
            right: window.innerWidth - rect.right + window.scrollX,
          });
        }
      };

      updatePosition();

      // Update position on scroll/resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      setDropdownPosition(null);
    }
  }, [showPublishOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
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
      onStatusChange("published");
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
      onStatusChange("draft");
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
      onStatusChange("archived");
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
      onStatusChange("draft");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể restore map");
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = () => {
    switch (status) {
        case "draft":
        return { label: "Nháp", color: "bg-gray-600", icon: "📝" };
      case "published":
        return { label: "Đã publish", color: "bg-green-600", icon: "✓" };
      case "archived":
        return { label: "Đã archive", color: "bg-red-600", icon: "🗄️" };
      default:
        return { label: "Unknown", color: "bg-gray-600", icon: "?" };
    }
  };

  const statusInfo = getStatusInfo();

  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      icon: JSX.Element;
      onClick: () => void;
      disabled?: boolean;
      description?: string;
    }> = [];

    if (status === "draft") {
      actions.push(
        {
          label: "Publish thành Storymap",
          icon: <SendIcon className="w-4 h-4" />,
          onClick: () => handlePublish(true),
          disabled: loading,
          description: "Có thể tạo session từ bản đồ này",
        },
        {
          label: "Publish để xem",
          icon: <SendIcon className="w-4 h-4" />,
          onClick: () => handlePublish(false),
          disabled: loading,
          description: "Chỉ để xem, không thể tạo session",
        }
      );
    } else if (status === "published") {
      if (!isStoryMap) {
        actions.push({
          label: "Xem Public",
          icon: <ExternalLinkIcon className="w-4 h-4" />,
          onClick: () => {
            router.push(`/maps/publish?mapId=${mapId}&view=true`);
            setShowPublishOptions(false);
          },
        });
      }
      actions.push(
        {
          label: "Unpublish",
          icon: <UndoIcon className="w-4 h-4" />,
          onClick: handleUnpublish,
          disabled: loading,
        },
        {
          label: "Archive",
          icon: <ArchiveIcon className="w-4 h-4" />,
          onClick: handleArchive,
          disabled: loading,
        }
      );
    } else if (status === "archived") {
      actions.push({
        label: "Restore",
        icon: <RefreshCcwIcon className="w-4 h-4" />,
        onClick: handleRestore,
        disabled: loading,
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      {/* Compact Status Badge */}
      <span
        className={`px-2.5 py-1.5 rounded-md text-xs font-medium ${statusInfo.color} text-white flex items-center gap-1.5`}
      >
        <span>{statusInfo.icon}</span>
        <span>{statusInfo.label}</span>
      </span>

      {/* Dropdown Menu Button */}
      {availableActions.length > 0 && (
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setShowPublishOptions(!showPublishOptions)}
            disabled={loading}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
            title="Actions"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${showPublishOptions ? 'rotate-180' : ''}`} />
            )}
          </button>

          {/* Dropdown Menu - Render via Portal */}
          {showPublishOptions && !loading && dropdownPosition && typeof window !== 'undefined' && createPortal(
            <div
              ref={dropdownRef}
              className="fixed bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-[99999] min-w-[240px]"
              style={{
                top: `${dropdownPosition.top}px`,
                right: `${dropdownPosition.right}px`,
              }}
            >
              <div className="py-1">
                {availableActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      action.onClick();
                      if (action.label !== "Xem Public") {
                        setShowPublishOptions(false);
                      }
                    }}
                    disabled={action.disabled}
                    className="w-full text-left px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 flex items-start gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="mt-0.5">{action.icon}</div>
                    <div className="flex-1">
                      <div className="font-medium">{action.label}</div>
                      {action.description && (
                        <div className="text-xs text-zinc-400 mt-0.5">{action.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 rounded-md bg-red-900 text-red-100 text-xs max-w-xs z-[99999] shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

