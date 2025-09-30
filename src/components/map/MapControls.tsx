import { LayerInfo } from "@/lib/mapUtils";

// ---------------- LayerPanel ----------------
export interface LayerPanelProps {
  layers: LayerInfo[];
  ready: boolean;
  showLayerPanel: boolean;
  setShowLayerPanel: (val: boolean) => void;
  renameLayer: (id: string, name: string) => void;
  toggleLayerVisibility: (id: string) => void;
  removeLayerFromList: (id: string) => void;
  clearLayers: () => void;
}

export function LayerPanel({
  layers,
  ready,
  showLayerPanel,
  setShowLayerPanel,
  renameLayer,
  toggleLayerVisibility,
  removeLayerFromList,
  clearLayers
}: LayerPanelProps) {
  return (
    <>
      {!showLayerPanel && (
        <div className="absolute top-15 right-1 z-[3000] pointer-events-auto">
          <button
            onClick={() => setShowLayerPanel(true)}
            className="flex w-10 h-10 justify-center items-center rounded-full bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-2xl text-white hover:bg-black/70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12.5 4.252a.75.75 0 0 0-1.005-.705l-6.84 2.475A1.75 1.75 0 0 0 3.5 7.667v6.082a.75.75 0 0 0 1.005.705L5 14.275v1.595a2.25 2.25 0 0 1-3-2.12V7.666A3.25 3.25 0 0 1 4.144 4.61l6.84-2.475A2.25 2.25 0 0 1 14 4.252v.177l-1.5.543zm4 3a.75.75 0 0 0-1.005-.705L8.325 9.14a1.25 1.25 0 0 0-.825 1.176v6.432a.75.75 0 0 0 1.005.705L9 17.275v1.596a2.25 2.25 0 0 1-3-2.122v-6.432A2.75 2.75 0 0 1 7.814 7.73l7.17-2.595A2.25 2.25 0 0 1 18 7.252v.177l-1.5.543zm2.995 2.295a.75.75 0 0 1 1.005.705v6.783a.75.75 0 0 1-.495.705l-7.5 2.714a.75.75 0 0 1-1.005-.705v-6.783a.75.75 0 0 1 .495-.705zm2.505.705a2.25 2.25 0 0 0-3.016-2.116l-7.5 2.714A2.25 2.25 0 0 0 10 12.966v6.783a2.25 2.25 0 0 0 3.016 2.116l7.5-2.714A2.25 2.25 0 0 0 22 17.035z"/>
            </svg>
          </button>
        </div>
      )}
      {showLayerPanel && (
        <div className="absolute top-15 right-1 z-[3000] w-80 max-h-[65vh] overflow-hidden pointer-events-auto bg-black/80 text-white rounded shadow-lg">
          <div className="flex justify-between items-center px-3 py-2 border-b border-gray-600">
            <span className="font-semibold">Layers</span>
            <button
              onClick={() => setShowLayerPanel(false)}
              className="px-2 py-1 rounded hover:bg-gray-500 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M6 16h2v2c0 .55.45 1 1 1s1-.45 1-1v-3c0-.55-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1m2-8H6c-.55 0-1 .45-1 1s.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1s-1 .45-1 1zm7 11c.55 0 1-.45 1-1v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-3c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1m1-11V6c0-.55-.45-1-1-1s-1 .45-1 1v3c0 .55.45 1 1 1h3c.55 0 1-.45 1-1s-.45-1-1-1z"/>
              </svg>
            </button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {layers.map(layer => (
              <div
                key={layer.id}
                className="flex items-center justify-between px-3 py-1 border-b border-gray-700"
              >
                <input
                  type="text"
                  defaultValue={layer.name}
                  onBlur={e => renameLayer(layer.id, e.target.value)}
                  className="bg-transparent text-white text-sm font-medium border-none outline-none flex-1 mr-2"
                />
                <button
                  onClick={() => toggleLayerVisibility(layer.id)}
                  className={`text-xs px-2 py-1 rounded ${
                    layer.visible
                      ? "bg-green-600 text-white"
                      : "bg-gray-600 text-gray-300"
                  }`}
                >
                  {layer.visible ? 
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
                        <path d="M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0"/>
                        <path d="M2 12c1.6-4.097 5.336-7 10-7s8.4 2.903 10 7c-1.6 4.097-5.336 7-10 7s-8.4-2.903-10-7"/>
                      </g>
                    </svg>
                  :
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
                        <path strokeLinejoin="round" d="M10.73 5.073A11 11 0 0 1 12 5c4.664 0 8.4 2.903 10 7a11.6 11.6 0 0 1-1.555 2.788M6.52 6.519C4.48 7.764 2.9 9.693 2 12c1.6 4.097 5.336 7 10 7a10.44 10.44 0 0 0 5.48-1.52m-7.6-7.6a3 3 0 1 0 4.243 4.243"/>
                        <path d="m4 4l16 16"/>
                      </g>
                    </svg>
                  }
                </button>
                <button
                  onClick={() => removeLayerFromList(layer.id)}
                  className="px-2 py-1 bg-red-600/80 rounded hover:bg-red-600"
                  disabled={!ready}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M7.616 20q-.672 0-1.144-.472T6 18.385V6H5V5h4v-.77h6V5h4v1h-1v12.385q0 .69-.462 1.153T16.384 20zM17 6H7v12.385q0 .269.173.442t.443.173h8.769q.23 0 .423-.192t.192-.424zM9.808 17h1V8h-1zm3.384 0h1V8h-1zM7 6v13z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {layers.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-600">
              <button
                onClick={clearLayers}
                className="px-2 py-1 rounded bg-red-600 text-white w-full cursor-pointer"
                disabled={!ready}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------- MapControls ----------------
export interface MapControlsProps {
  locating: boolean;
  goMyLocation: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export function MapControls({
  locating,
  goMyLocation,
  zoomIn,
  zoomOut
}: MapControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 z-[3000] flex flex-col gap-2">
      <button
        onClick={zoomIn}
        className="flex w-10 h-10 justify-center items-center rounded-full bg-white text-black shadow hover:bg-gray-200 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path fill="currentColor" d="M13 6a1 1 0 1 0-2 0v5H6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5z"/>
        </svg>
      </button>
      <button
        onClick={zoomOut}
        className="flex w-10 h-10 justify-center items-center rounded-full bg-white text-black shadow hover:bg-gray-200 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14"/>
        </svg>
      </button>
      <button
        onClick={goMyLocation}
        className="flex w-10 h-10 justify-center items-center rounded-full bg-emerald-400 text-white shadow hover:bg-emerald-500 cursor-pointer"
      >
        {locating ? 
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="2" r="0" fill="currentColor"><animate attributeName="r" begin="0" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(45 12 12)"><animate attributeName="r" begin="0.125s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(90 12 12)"><animate attributeName="r" begin="0.25s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(135 12 12)"><animate attributeName="r" begin="0.375s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(180 12 12)"><animate attributeName="r" begin="0.5s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(225 12 12)"><animate attributeName="r" begin="0.625s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(270 12 12)"><animate attributeName="r" begin="0.75s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(315 12 12)"><animate attributeName="r" begin="0.875s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
            </svg>
            :
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m5.252 9.975l11.66-5.552c1.7-.81 3.474.965 2.665 2.666l-5.552 11.659c-.759 1.593-3.059 1.495-3.679-.158L9.32 15.851a2 2 0 0 0-1.17-1.17l-2.74-1.027c-1.652-.62-1.75-2.92-.157-3.679"/>
            </svg>
        }
      </button>
    </div>
  );
}
