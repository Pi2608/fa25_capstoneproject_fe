"use client";

export interface ZoomControlsProps {
  zoomIn: () => void;
  zoomOut: () => void;
  showPoiPanel?: boolean;
  onTogglePoiPanel?: () => void;
  showStoryMapPanel?: boolean;
  onToggleStoryMapPanel?: () => void;
  isTimelineOpen?: boolean;
}

export default function ZoomControls({
  zoomIn,
  zoomOut,
  showPoiPanel,
  onTogglePoiPanel,
  showStoryMapPanel,
  onToggleStoryMapPanel,
  isTimelineOpen = true,
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
      <button
        onClick={zoomOut}
        className="flex w-8 h-8 justify-center items-center rounded-md bg-zinc-800 text-zinc-300 shadow hover:bg-zinc-700 cursor-pointer transition-colors"
        title="Zoom out"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14"/>
        </svg>
      </button>

      {/* POI Panel Toggle */}
      {onTogglePoiPanel && (
        <button
          onClick={onTogglePoiPanel}
          className={`flex w-8 h-8 justify-center items-center rounded-md shadow cursor-pointer transition-colors ${
            showPoiPanel
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          title="Toggle POI Panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}

      {/* Story Map Timeline Toggle */}
      {onToggleStoryMapPanel && (
        <button
          onClick={onToggleStoryMapPanel}
          className={`flex w-8 h-8 justify-center items-center rounded-md shadow cursor-pointer transition-colors ${
            showStoryMapPanel
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          title="Toggle Story Map Timeline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        </button>
      )}
    </div>
  );
}
