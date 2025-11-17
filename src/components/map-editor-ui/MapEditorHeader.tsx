import { useCallback, type PropsWithChildren } from "react";
import { PublishButton } from "@/components/map-editor";
import type { MapStatus } from "@/lib/api-maps";
import {
  MapPin,
  Route,
  Shapes,
  Square,
  Circle as CircleIcon,
  Type as TypeIcon,
  Scissors,
  RotateCw,
  Move,
  Edit3,
} from "lucide-react";

type DrawShape =
  | "Marker"
  | "Line"
  | "Polygon"
  | "Rectangle"
  | "Circle"
  | "CircleMarker"
  | "Text";

interface ActiveUser {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  highlightColor: string;
}

interface MapEditorHeaderProps {
  name: string;
  mapId: string;
  mapStatus: MapStatus;
  busySaveMeta: boolean;
  busySaveView: boolean;
  activeTool: string | null;
  isCutMode: boolean;
  isRotateMode: boolean;
  isDragMode: boolean;
  isEditMode: boolean;
  canUseMapControls: boolean;
  activeUsers: ActiveUser[];
  isCollaborationConnected: boolean;
  onNameChange: (value: string) => void;
  onStatusChange: (status: MapStatus) => void;
  onEnableDraw: (shape: DrawShape) => void;
  onCutToggle: () => void;
  onRotateToggle: () => void;
  onDragToggle: () => void;
  onEditToggle: () => void;
  onUploadLayer: (file: File) => Promise<void>;
  onSaveView: () => void;
  onClearSketch: () => void;
  onSaveMeta: () => void;
  onResetDeleteConfirm: () => void;
  getInitials: (email: string) => string;
}

const GuardBtn = ({
  title,
  onClick,
  disabled,
  isActive,
  children,
}: PropsWithChildren<{
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  isActive?: boolean;
}>) => (
  <button
    className={`px-2 py-1.5 rounded-md text-white text-xs transition-colors ${
      isActive
        ? "bg-emerald-500/40 ring-1 ring-emerald-400/50 shadow-sm"
        : "bg-transparent hover:bg-emerald-500/20"
    }`}
    title={title}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

export function MapEditorHeader({
  name,
  mapId,
  mapStatus,
  busySaveMeta,
  busySaveView,
  activeTool,
  isCutMode,
  isRotateMode,
  isDragMode,
  isEditMode,
  canUseMapControls,
  activeUsers,
  isCollaborationConnected,
  onNameChange,
  onStatusChange,
  onEnableDraw,
  onCutToggle,
  onRotateToggle,
  onDragToggle,
  onEditToggle,
  onUploadLayer,
  onSaveView,
  onClearSketch,
  onSaveMeta,
  onResetDeleteConfirm,
  getInitials,
}: MapEditorHeaderProps) {
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await onUploadLayer(file);
      } finally {
        event.target.value = "";
      }
    },
    [onUploadLayer]
  );

  return (
    <div className="grid grid-cols-3 place-items-stretch gap-2">
      <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="px-2.5 py-1.5 rounded-md bg-white text-black text-sm font-medium w-52"
          placeholder="Untitled Map"
        />
        <PublishButton mapId={mapId} status={mapStatus} onStatusChange={onStatusChange} />
      </div>
      <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
        <GuardBtn
          title="Vẽ điểm"
          onClick={() => onEnableDraw("Marker")}
          disabled={!canUseMapControls}
          isActive={activeTool === "Marker"}
        >
          <MapPin size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Vẽ đường"
          onClick={() => onEnableDraw("Line")}
          disabled={!canUseMapControls}
          isActive={activeTool === "Line"}
        >
          <Route size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Vẽ vùng"
          onClick={() => onEnableDraw("Polygon")}
          disabled={!canUseMapControls}
          isActive={activeTool === "Polygon"}
        >
          <Shapes size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Vẽ hình chữ nhật"
          onClick={() => onEnableDraw("Rectangle")}
          disabled={!canUseMapControls}
          isActive={activeTool === "Rectangle"}
        >
          <Square size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Vẽ hình tròn"
          onClick={() => onEnableDraw("Circle")}
          disabled={!canUseMapControls}
          isActive={activeTool === "Circle"}
        >
          <CircleIcon size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Thêm chữ"
          onClick={() => onEnableDraw("Text")}
          disabled={!canUseMapControls}
          isActive={activeTool === "Text"}
        >
          <TypeIcon size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Cắt polygon"
          onClick={onCutToggle}
          disabled={!canUseMapControls}
          isActive={isCutMode}
        >
          <Scissors size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Xoay đối tượng"
          onClick={onRotateToggle}
          disabled={!canUseMapControls}
          isActive={isRotateMode}
        >
          <RotateCw size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Di chuyển đối tượng"
          onClick={onDragToggle}
          disabled={!canUseMapControls}
          isActive={isDragMode}
        >
          <Move size={18} strokeWidth={1.8} />
        </GuardBtn>
        <GuardBtn
          title="Chỉnh sửa đối tượng"
          onClick={onEditToggle}
          disabled={!canUseMapControls}
          isActive={isEditMode}
        >
          <Edit3 size={18} strokeWidth={1.8} />
        </GuardBtn>
      </div>
      <div className="flex items-center justify-end gap-1.5 overflow-x-auto no-scrollbar">
        {activeUsers.length > 0 && (
          <div className="flex items-center gap-1.5 mr-2">
            {activeUsers.slice(0, 3).map((user) => (
              <div key={user.userId} className="relative group" title={user.userName}>
                {user.userAvatar ? (
                  <img
                    src={user.userAvatar}
                    alt={user.userName}
                    className="w-8 h-8 rounded-full border-2 border-white/30 object-cover"
                    style={{ borderColor: user.highlightColor }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold text-white"
                    style={{
                      backgroundColor: user.highlightColor,
                      borderColor: user.highlightColor,
                    }}
                  >
                    {getInitials(user.userName)}
                  </div>
                )}
              </div>
            ))}
            {activeUsers.length > 3 && (
              <div
                className="w-8 h-8 rounded-full border-2 border-white/30 bg-zinc-700 flex items-center justify-center text-xs font-semibold text-white"
                title={`${activeUsers.length - 3} more user(s)`}
              >
                +{activeUsers.length - 3}
              </div>
            )}
            {isCollaborationConnected && (
              <div className="flex items-center gap-1 ml-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Connected" />
              </div>
            )}
          </div>
        )}
        <input
          type="file"
          accept=".geojson,.json,.kml,.gpx"
          onChange={handleFileChange}
          className="hidden"
          id="upload-layer"
        />
        <label
          htmlFor="upload-layer"
          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 cursor-pointer"
          title="Upload GeoJSON/KML/GPX file to add as layer"
        >
          Upload File
        </label>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
          onClick={onSaveView}
          disabled={busySaveView || !canUseMapControls}
          title="Lưu tâm & zoom hiện tại"
        >
          {busySaveView ? "Đang lưu…" : "Save view"}
        </button>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700"
          onClick={onClearSketch}
          disabled={!canUseMapControls}
        >
          Xoá vẽ
        </button>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
          onClick={onSaveMeta}
          disabled={busySaveMeta}
        >
          {busySaveMeta ? "Đang lưu…" : "Save"}
        </button>
        {mapStatus === "Published" && (
          <>
            <button
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1"
              onClick={() => window.open(`/storymap/control/${mapId}`, "_blank")}
              title="Open control panel (presenter view)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
              Control
            </button>
            <button
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 flex items-center gap-1"
              onClick={() => window.open(`/storymap/${mapId}`, "_blank")}
              title="Open viewer (audience view)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              View
            </button>
          </>
        )}
        <button
          className="rounded-lg p-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600"
          onClick={onResetDeleteConfirm}
          title="Re-enable delete confirmation dialogs"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

