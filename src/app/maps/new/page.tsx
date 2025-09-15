"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import { createMap, type CreateMapRequest } from "@/lib/api";

type LNS = typeof import("leaflet");
type LMap = import("leaflet").Map;
type LLayer = import("leaflet").Layer;
type LFeatureGroup = import("leaflet").FeatureGroup;
type LTileLayer = import("leaflet").TileLayer;
type LatLngTuple = import("leaflet").LatLngTuple;
type LeafletEvent = import("leaflet").LeafletEvent;

type MapWithPM = LMap & {
  pm: {
    addControls: (opts: {
      position?: string;
      drawMarker?: boolean;
      drawPolyline?: boolean;
      drawRectangle?: boolean;
      drawPolygon?: boolean;
      drawCircle?: boolean;
      drawCircleMarker?: boolean;
      drawText?: boolean;
      editMode?: boolean;
      dragMode?: boolean;
      cutPolygon?: boolean;
      removalMode?: boolean;
    }) => void;
  };
};

interface LayerInfo {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  layer: LLayer;
  order: number;
}

type PMCreateEvent = LeafletEvent & { layer: LLayer };
type BaseKey = "osm" | "sat" | "dark";

function NewMapPageInner() {
  const q = useSearchParams();
  const router = useRouter();

  const orgId: string | undefined = q?.get("org") ?? undefined;

  const mapEl = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LNS | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const baseRef = useRef<LTileLayer | null>(null);
  const sketchRef = useRef<LFeatureGroup | null>(null);

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapName, setMapName] = useState("Untitled Map");
  const [description, setDescription] = useState("");
  const [baseLayer, setBaseLayer] = useState<BaseKey>("osm");
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [layerCounter, setLayerCounter] = useState(0);

  const isMapValid = useCallback((): boolean => {
    const map = mapRef.current as (LMap & { _removed?: boolean; _loaded?: boolean }) | null;
    return !!(map && !map._removed && (map._loaded ?? true));
  }, []);

  const getLayerType = useCallback((layer: any): string => {
    if (layer.feature?.geometry?.type) {
      return layer.feature.geometry.type;
    }
    if (layer._mRadius) return "Circle";
    if (layer._latlng) return "Marker";
    if (layer._latlngs) {
      if (layer._latlngs[0]?.length > 2) return "Polygon";
      return "Polyline";
    }
    if (layer._bounds) return "Rectangle";
    return "Unknown";
  }, []);

  const addLayerToList = useCallback((layer: LLayer | LFeatureGroup) => {
    if ("eachLayer" in layer && typeof layer.eachLayer === "function") {
      // Nếu là FeatureGroup (GeoJSON nhiều feature)
      layer.eachLayer((subLayer: any) => {
        const props = subLayer.feature?.properties || {};
        const layerName = props.name || props.Name || `Layer ${Date.now()}`;

        setLayers(prevLayers => [
          ...prevLayers,
          {
            id: `layer_${Date.now()}_${Math.random().toString(36)}`,
            name: layerName, // đặt tên từ attribute name
            type: getLayerType(subLayer),
            visible: true,
            layer: subLayer,
            order: prevLayers.length,
          },
        ]);
      });
    } else {
      // Nếu là layer đơn (Marker, Polygon, Circle…)
      const props = (layer as any).feature?.properties || {};
      const layerName = props.name || props.Name || `Layer ${Date.now()}`;

      setLayers(prevLayers => [
        ...prevLayers,
        {
          id: `layer_${Date.now()}_${Math.random().toString(36)}`,
          name: layerName,
          type: getLayerType(layer),
          visible: true,
          layer,
          order: prevLayers.length,
        },
      ]);
    }
  }, [getLayerType]);

  const removeLayerFromList = useCallback((layerId: string) => {
    setLayers(prev => {
      const layerInfo = prev.find(l => l.id === layerId);
      if (layerInfo && mapRef.current && sketchRef.current) {
        sketchRef.current.removeLayer(layerInfo.layer);
      }
      return prev.filter(l => l.id !== layerId);
    });
  }, []);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers(prev => prev.map(layerInfo => {
      if (layerInfo.id === layerId) {
        const newVisible = !layerInfo.visible;
        if (mapRef.current && sketchRef.current) {
          if (newVisible) {
            sketchRef.current.addLayer(layerInfo.layer);
          } else {
            sketchRef.current.removeLayer(layerInfo.layer);
          }
        }
        return { ...layerInfo, visible: newVisible };
      }
      return layerInfo;
    }));
  }, []);

  const renameLayer = useCallback((layerId: string, newName: string) => {
    setLayers(prev => prev.map(layerInfo => 
      layerInfo.id === layerId ? { ...layerInfo, name: newName.trim() || layerInfo.name } : layerInfo
    ));
  }, []);

  const applyBaseLayer = useCallback((kind: BaseKey) => {
    const L = LRef.current;
    const map = mapRef.current as (LMap & { _loaded?: boolean }) | null;
    if (!L || !map) return;

    if (baseRef.current) {
      map.removeLayer(baseRef.current);
      baseRef.current = null;
    }

    let layer: LTileLayer;
    if (kind === "sat") {
      layer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, attribution: "Tiles © Esri" }
      );
    } else if (kind === "dark") {
      layer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 20, attribution: "© OpenStreetMap contributors © CARTO" }
      );
    } else {
      layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        attribution: "© OpenStreetMap contributors",
      });
    }

    if ((map as { _loaded?: boolean })._loaded === false) {
      map.whenReady(() => {
        layer.addTo(map);
        baseRef.current = layer;
      });
    } else {
      layer.addTo(map);
      baseRef.current = layer;
    }
  }, []);

  const goMyLocation = useCallback(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const target: LatLngTuple = [pos.coords.latitude, pos.coords.longitude];
        map.stop();
        map.invalidateSize();
        map.setView(target, Math.max(map.getZoom(), 16));
        L.circleMarker(target, { radius: 6 }).addTo(map);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }, []);

  const saveMap = useCallback(async () => {
    if (!mapName.trim()) {
      alert("Nhập tên bản đồ trước khi lưu.");
      return;
    }
    if (!isMapValid()) {
      alert("Map chưa sẵn sàng.");
      return;
    }

    setSaving(true);
    try {
      const map = mapRef.current!;
      const center = map.getCenter();
      const zoomRaw = map.getZoom();
      const zoom = Math.max(1, Math.min(20, typeof zoomRaw === "number" ? zoomRaw : 13));

      const baseForApi: CreateMapRequest["baseMapProvider"] =
        baseLayer === "osm" ? "OSM" : baseLayer === "sat" ? "Satellite" : "Dark";

      const body: CreateMapRequest = {
        name: mapName.trim(),
        description: description.trim(),
        isPublic: false,
        initialLatitude: center.lat,
        initialLongitude: center.lng,
        initialZoom: zoom,
        baseMapProvider: baseForApi,
        orgId,
      };

      const created = await createMap(body);
      const id = created.mapId;
      router.push(`/maps/${id}?created=1&name=${encodeURIComponent(mapName.trim())}`);
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message)
          : "Lưu bản đồ thất bại";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }, [mapName, description, baseLayer, orgId, router, isMapValid]);

  // Geoman custom actions
  const enableDraw = (shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text" ) => {
    mapRef.current?.pm.enableDraw(shape);
  };

  const toggleEdit = () => {
    mapRef.current?.pm.toggleGlobalEditMode();
  };

  const toggleDelete = () => {
    mapRef.current?.pm.toggleGlobalRemovalMode();
  };

  const toggleDrag = () => {
    mapRef.current?.pm.toggleGlobalDragMode();
  };

  const enableCutPolygon = () => {
    mapRef.current?.pm.enableGlobalCutMode();
  };

  const toggleRotate = () => {
    mapRef.current?.pm.toggleGlobalRotateMode();
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      const L: typeof import("leaflet") = await import("leaflet");
      await import("@geoman-io/leaflet-geoman-free");

      if (!alive || !mapEl.current) return;

      LRef.current = L;

      const map = L.map(mapEl.current, { zoomControl: false }).setView([10.78, 106.69], 13);
      mapRef.current = map;

      const sketch = L.featureGroup().addTo(map);
      sketchRef.current = sketch;

      (map as MapWithPM).pm.addControls({
        position: "topleft",
        drawMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawPolygon: false,
        drawCircle: false,
        drawCircleMarker: false,
        drawText: false,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        rotateMode: false,
        removalMode: false,
      });


      map.on("pm:create", (e: LeafletEvent) => {
        const evt = e as PMCreateEvent;
        sketch.addLayer(evt.layer);
        addLayerToList(evt.layer);
      });

      map.whenReady(() => {
        setReady(true);
      });
    })();

    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      baseRef.current = null;
      sketchRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyBaseLayer(baseLayer);
  }, [ready, baseLayer, applyBaseLayer]);

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">
      {/* <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[3000] w-full max-w-6xl px-4 pointer-events-none"> */}
      <div className="absolute top-0 left-0 z-[3000] w-full pointer-events-none">
        <div className="pointer-events-auto bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-2xl py-2 px-4">
          {/* <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">Base</span>
              <select
                value={baseLayer}
                onChange={(e) => setBaseLayer(e.target.value as BaseKey)}
                className="px-2 py-2 rounded-md bg-white text-black text-sm"
              >
                <option value="osm">OSM</option>
                <option value="sat">Satellite</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <button
              className="rounded-xl px-3.5 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700"
              onClick={() => sketchRef.current?.clearLayers()}
              disabled={!ready}
            >
              Xoá vẽ
            </button>
          </div> */}
          <div className="grid grid-cols-3 place-items-stretch gap-2">
            <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
              <input
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-56"
              placeholder="Tên bản đồ"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-72"
              placeholder="Mô tả (tuỳ chọn)"
            />
            </div>

            <div className="flex items-center justify-center overflow-x-auto no-scrollbar">
              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={() => enableDraw("Marker")}
                disabled={!ready}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none">
                  <path d="M12 2a8 8 0 0 1 8 8c0 6.5-8 12-8 12s-8-5.5-8-12a8 8 0 0 1 8-8m0 5a3 3 0 1 0 0 6a3 3 0 0 0 0-6" clipRule="evenodd"/>
                  <path stroke="currentColor" strokeWidth="2" d="M20 10c0 6.5-8 12-8 12s-8-5.5-8-12a8 8 0 1 1 16 0Z"/>
                  <path stroke="currentColor" strokeWidth="2" d="M15 10a3 3 0 1 1-6 0a3 3 0 0 1 6 0Z"/></g>
                </svg>
              </button>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={() => enableDraw("Line")}
                disabled={!ready}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 15 15">
                  <path fill="none" stroke="currentColor" d="m2 2l11 11M1.5 2.5a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm12 12a1 1 0 1 1 0-2a1 1 0 0 1 0 2Z" strokeWidth="1"/>
                </svg>
              </button>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={() => enableDraw("Polygon")}
                disabled={!ready}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 100 100">
                  <path fill="currentColor" d="M32.5 10.95c-6.89 0-12.55 5.66-12.55 12.55c0 4.02 1.935 7.613 4.91 9.916L14.815 54.172a12.4 12.4 0 0 0-2.316-.223C5.61 53.95-.05 59.61-.05 66.5S5.61 79.05 12.5 79.05c5.13 0 9.54-3.151 11.463-7.603l51.277 7.71c1.232 5.629 6.281 9.894 12.26 9.894c6.656 0 12.114-5.297 12.48-11.867a3.5 3.5 0 0 0 .07-.684a3.5 3.5 0 0 0-.071-.7c-.375-6.562-5.829-11.85-12.479-11.85c-.134 0-.264.015-.396.019L80.242 43.05c3.275-2.127 5.509-5.746 5.738-9.867a3.5 3.5 0 0 0 .07-.684a3.5 3.5 0 0 0-.071-.7c-.375-6.562-5.829-11.85-12.479-11.85c-5.062 0-9.452 3.06-11.43 7.415l-17.082-4.517l-.01-.047c-.374-6.563-5.828-11.852-12.478-11.852m0 7c3.107 0 5.55 2.443 5.55 5.55s-2.443 5.55-5.55 5.55s-5.55-2.443-5.55-5.55s2.443-5.55 5.55-5.55m41 9c3.107 0 5.55 2.443 5.55 5.55s-2.443 5.55-5.55 5.55s-5.55-2.443-5.55-5.55s2.443-5.55 5.55-5.55m-30.137 2.708l17.739 4.69C62.007 40.37 67.239 45.05 73.5 45.05l.033-.002l6.92 21.092a12.7 12.7 0 0 0-4.705 6.015l-50.916-7.654a12.6 12.6 0 0 0-3.787-7.13l10.342-21.378c.368.033.737.057 1.113.057c4.652 0 8.71-2.592 10.863-6.393M12.5 60.95c3.107 0 5.55 2.444 5.55 5.551s-2.443 5.55-5.55 5.55s-5.55-2.443-5.55-5.55s2.443-5.55 5.55-5.55m75 10c3.107 0 5.55 2.444 5.55 5.551s-2.443 5.55-5.55 5.55s-5.55-2.443-5.55-5.55s2.443-5.55 5.55-5.55" color="currentColor"/>
                </svg>
              </button>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={() => enableDraw("Rectangle")}
                disabled={!ready}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 100 100">
                  <path fill="currentColor" d="M12.55 15C5.662 15 0 20.661 0 27.55c0 6.017 4.317 11.096 10 12.286v20.428c-5.683 1.19-10 6.27-10 12.287C0 79.44 5.661 85.1 12.55 85.1c6.047 0 11.09-4.374 12.241-10.1h50.455c1.152 5.732 6.253 10.1 12.305 10.1c6.65 0 12.105-5.288 12.478-11.852a3.5 3.5 0 0 0 .07-.697a3.5 3.5 0 0 0-.07-.697C99.703 66.117 95.495 61.356 90 60.246V39.854c5.495-1.11 9.703-5.87 10.03-11.606a3.5 3.5 0 0 0 .07-.697a3.5 3.5 0 0 0-.07-.697C99.655 20.29 94.201 15 87.55 15c-6.016 0-11.096 4.317-12.286 10H24.77c-1.19-5.676-6.209-10-12.22-10m0 7c3.107 0 5.55 2.444 5.55 5.55c0 3.107-2.443 5.55-5.55 5.55S7 30.657 7 27.55S9.444 22 12.55 22m75 0c3.107 0 5.55 2.444 5.55 5.55c0 3.107-2.443 5.55-5.55 5.55S82 30.657 82 27.55S84.444 22 87.55 22M24.218 32h51.62A12.68 12.68 0 0 0 83 39.225v21.65A12.68 12.68 0 0 0 75.875 68h-51.7A12.64 12.64 0 0 0 17 60.838V39.262A12.64 12.64 0 0 0 24.217 32M12.55 67c3.106 0 5.549 2.444 5.549 5.55c0 3.107-2.443 5.55-5.55 5.55S7 75.657 7 72.55S9.444 67 12.55 67m75 0c3.106 0 5.549 2.444 5.549 5.55c0 3.107-2.443 5.55-5.55 5.55S82 75.657 82 72.55S84.444 67 87.55 67" color="currentColor"/>
                </svg>
              </button>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={() => enableDraw("Circle")}
                disabled={!ready}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <g fill="none"><circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
                    <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
                  </g>
                </svg>
              </button>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={() => enableDraw("Text")}
                disabled={!ready}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 20V4m7 2V4H5v2m9 14h-4"/>
                </svg>
              </button>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={toggleRotate}
                disabled={!ready}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.95 11a8 8 0 1 0-.5 4m.5 5v-5h-5"/>
                </svg>
              </button>

              
              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={enableCutPolygon}
                disabled={!ready}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48">
                  <g fill="none" stroke="currentColor" strokeWidth="4">
                    <path strokeLinejoin="round" d="M11 42a5 5 0 1 0 0-10a5 5 0 0 0 0 10Zm26 0a5 5 0 1 0 0-10a5 5 0 0 0 0 10Z"/>
                    <path strokeLinecap="round" d="m15.377 39.413l2.123-3.597l17-29.445"/><path strokeLinecap="round" d="m13.496 6.175l17 29.445l2.13 3.793"/>
                  </g>
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar">
              <label className="px-3 py-2 rounded-md bg-transparent text-white text-sm cursor-pointer hover:bg-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="currentColor" fillRule="evenodd" d="M12 2a6 6 0 0 0-5.476 3.545a23 23 0 0 1-.207.452l-.02.001C6.233 6 6.146 6 6 6a4 4 0 1 0 0 8h.172l2-2H6a2 2 0 1 1 0-4h.064c.208 0 .45.001.65-.04a1.9 1.9 0 0 0 .7-.27c.241-.156.407-.35.533-.527a2.4 2.4 0 0 0 .201-.36q.08-.167.196-.428l.004-.01a4.001 4.001 0 0 1 7.304 0l.005.01q.115.26.195.428c.046.097.114.238.201.36c.126.176.291.371.533.528c.242.156.487.227.7.27c.2.04.442.04.65.04L18 8a2 2 0 1 1 0 4h-2.172l2 2H18a4 4 0 0 0 0-8c-.146 0-.233 0-.297-.002h-.02l-.025-.053a24 24 0 0 1-.182-.4A6 6 0 0 0 12 2m5.702 4.034" clipRule="evenodd"/>
                  <path fill="currentColor" d="m12 12l-.707-.707l.707-.707l.707.707zm1 9a1 1 0 1 1-2 0zm-5.707-5.707l4-4l1.414 1.414l-4 4zm5.414-4l4 4l-1.414 1.414l-4-4zM13 12v9h-2v-9z"/>
                </svg>
                <input
                  type="file"
                  accept=".geojson,.json,.kml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const data = JSON.parse(reader.result as string);
                          if (mapRef.current && LRef.current) {
                            const geoLayer = LRef.current.geoJSON(data, {
                              style: {
                                color: "red",
                                weight: 2,
                                fillOpacity: 0.1,
                              }
                            });

                            geoLayer.addTo(mapRef.current);
                            addLayerToList(geoLayer);
                            mapRef.current.fitBounds(geoLayer.getBounds());
                          }
                        } catch (err) {
                          alert("File không hợp lệ hoặc không phải GeoJSON!");
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />

              </label>
              <button
                className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-emerald-400 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
                onClick={() => void saveMap()}
                disabled={!ready || saving}
              >
                {saving ? "Đang lưu…" : "Lưu và chỉnh sửa"}
              </button>
            </div>

            {/* <button
              className="px-3 py-2 rounded-md bg-green-500 text-white text-sm hover:bg-green-600"
              onClick={toggleEdit}
              disabled={!ready}
            >
              Edit
            </button>
            <button
              className="px-3 py-2 rounded-md bg-red-500 text-white text-sm hover:bg-red-600"
              onClick={toggleDelete}
              disabled={!ready}
            >
              Delete
            </button>
            <button
              className="px-3 py-2 rounded-md bg-yellow-500 text-white text-sm hover:bg-yellow-600"
              onClick={toggleDrag}
              disabled={!ready}
            >
              Drag
            </button> */}
          </div>

        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-[3000] flex flex-col gap-2">
        <button
          className="flex w-10 h-10 justify-center items-center rounded-full bg-white text-black shadow hover:bg-gray-200 cursor-pointer"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M13 6a1 1 0 1 0-2 0v5H6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5z"/>
          </svg>
        </button>

        <button
          className="flex w-10 h-10 justify-center items-center rounded-full bg-white text-black shadow hover:bg-gray-200 cursor-pointer"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14"/>
          </svg>
        </button>

        <button
          className="flex w-10 h-10 justify-center items-center rounded-full bg-emerald-400 text-white shadow hover:bg-emerald-500 cursor-pointer"
          onClick={goMyLocation}
        >
          {locating ? (
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
              ):(
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m5.252 9.975l11.66-5.552c1.7-.81 3.474.965 2.665 2.666l-5.552 11.659c-.759 1.593-3.059 1.495-3.679-.158L9.32 15.851a2 2 0 0 0-1.17-1.17l-2.74-1.027c-1.652-.62-1.75-2.92-.157-3.679"/>
            </svg>
            )
          }
        </button>
      </div>


      {showLayerPanel && (
        <div className="absolute top-15 right-1 z-[3000] w-80 max-h-[65vh] overflow-hidden pointer-events-auto">
          <div className="rounded-2xl bg-black/90 backdrop-blur-md ring-1 ring-white/20 shadow-2xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Layers</h3>
                <button
                  onClick={() => setShowLayerPanel(false)}
                  className="text-white/60 hover:text-white text-xl leading-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M6 16h2v2c0 .55.45 1 1 1s1-.45 1-1v-3c0-.55-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1m2-8H6c-.55 0-1 .45-1 1s.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1s-1 .45-1 1zm7 11c.55 0 1-.45 1-1v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-3c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1m1-11V6c0-.55-.45-1-1-1s-1 .45-1 1v3c0 .55.45 1 1 1h3c.55 0 1-.45 1-1s-.45-1-1-1z"/>
                  </svg>
                </button>
              </div>
              
              {layers.length === 0 ? (
                <div className="text-white/60 text-sm text-center py-8">
                  Chưa có layer nào. Hãy vẽ gì đó trên bản đồ!
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                  {layers.map((layerInfo) => (
                    <div
                      key={layerInfo.id}
                      className="bg-white/10 rounded-lg p-3 border border-white/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <input
                          type="text"
                          value={layerInfo.name}
                          onChange={(e) => renameLayer(layerInfo.id, e.target.value)}
                          className="bg-transparent text-white text-sm font-medium border-none outline-none flex-1 mr-2"
                          onBlur={(e) => renameLayer(layerInfo.id, e.target.value)}
                        />
                        <button
                          onClick={() => toggleLayerVisibility(layerInfo.id)}
                          className={`text-xs px-2 py-1 rounded ${
                            layerInfo.visible
                              ? "bg-green-600 text-white"
                              : "bg-gray-600 text-gray-300"
                          }`}
                        >
                          {layerInfo.visible ? 
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
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-white/60">
                        <span>{layerInfo.type}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => removeLayerFromList(layerInfo.id)}
                            className="px-2 py-1 bg-red-600/80 rounded hover:bg-red-600"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M7.616 20q-.672 0-1.144-.472T6 18.385V6H5V5h4v-.77h6V5h4v1h-1v12.385q0 .69-.462 1.153T16.384 20zM17 6H7v12.385q0 .269.173.442t.443.173h8.769q.23 0 .423-.192t.192-.424zM9.808 17h1V8h-1zm3.384 0h1V8h-1zM7 6v13z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={mapEl} className="absolute inset-0" />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .leaflet-top.leaflet-left {
          top: 88px;
        }
        .leaflet-container {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </main>
  );
}

export default function NewMapPage() {
  return (
    <Suspense fallback={<div className="p-4 text-zinc-400">Đang tải…</div>}>
      <NewMapPageInner />
    </Suspense>
  );
}
