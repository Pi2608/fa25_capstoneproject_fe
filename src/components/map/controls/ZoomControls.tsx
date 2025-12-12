"use client";

export interface ZoomControlsProps {
  zoomIn: () => void;
  zoomOut: () => void;
  isTimelineOpen?: boolean;
  currentZoom?: number;
}

export default function ZoomControls({
  zoomIn,
  zoomOut,
  isTimelineOpen = true,
  currentZoom,
}: ZoomControlsProps) {
  const bottomPosition = isTimelineOpen ? "12px" : "40px"; 

  return (
    <div
      className="fixed right-4 z-[1600] flex items-center gap-2 bg-zinc-950/98 backdrop-blur-lg border border-zinc-800 px-3 py-2 rounded-lg shadow-lg transition-all duration-300"
      style={{ bottom: bottomPosition }}
    >
      <button
        onClick={zoomIn}
        className="flex w-8 h-8 justify-center items-center rounded-md bg-zinc-800 text-zinc-300 shadow hover:bg-zinc-700 cursor-pointer transition-colors"
        title="Zoom in"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
          <path fill="currentColor" d="M13 6a1 1 0 1 0-2 0v5H6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5z"/>
        </svg>
      </button>
      {currentZoom !== undefined && (
        <div className="flex items-center justify-center min-w-[40px] px-2 text-sm font-medium text-zinc-300">
          {currentZoom % 1 === 0 ? currentZoom.toString() : currentZoom.toFixed(1)}
        </div>
      )}
      <button
        onClick={zoomOut}
        className="flex w-8 h-8 justify-center items-center rounded-md bg-zinc-800 text-zinc-300 shadow hover:bg-zinc-700 cursor-pointer transition-colors"
        title="Zoom out"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14"/>
        </svg>
      </button>
    </div>
  );
}
