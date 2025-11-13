type TimelineHeaderProps = {
  segments: any[];
  currentSegmentLayers: any[];
  isPlaying: boolean;
  currentPlayIndex: number;
  onPlayPreview: () => void;
  onStopPreview: () => void;
  onClearMap: () => void;
  onCreateSegment: () => void;
  onOpenTransitions: () => void;
};

export default function TimelineHeader({
  segments,
  currentSegmentLayers,
  isPlaying,
  currentPlayIndex,
  onPlayPreview,
  onStopPreview,
  onClearMap,
  onCreateSegment,
  onOpenTransitions,
}: TimelineHeaderProps) {
  return (
    <div className="px-4 py-2 border-b border-zinc-800">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button
              onClick={onOpenTransitions}
              className="px-2.5 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded flex items-center gap-1"
              title="Manage timeline transitions"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Transitions
            </button>
            <button
              onClick={onCreateSegment}
              className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded"
            >
              + Segment
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {!isPlaying ? (
            <button
              onClick={onPlayPreview}
              disabled={segments.length === 0}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Play preview of all segments"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Play Preview
            </button>
          ) : (
            <button
              onClick={onStopPreview}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded flex items-center gap-1"
              title="Stop preview"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                  clipRule="evenodd"
                />
              </svg>
              Stop
            </button>
          )}
          <button
            onClick={onClearMap}
            disabled={currentSegmentLayers.length === 0}
            className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all layers from map"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear
          </button>
        </div>
      </div>

      {isPlaying && (
        <div className="mt-1 text-xs text-zinc-400">
          Playing segment {currentPlayIndex + 1} of {segments.length}
        </div>
      )}
    </div>
  );
}
