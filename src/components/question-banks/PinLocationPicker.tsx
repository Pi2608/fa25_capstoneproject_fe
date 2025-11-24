"use client";

import { useCallback, useMemo } from "react";
import { MapPin } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMapEvents,
} from "react-leaflet";

export type PinLocationPickerProps = {
  latitude: string;
  longitude: string;
  radiusMeters: string;
  onChange: (lat: string, lng: string) => void;
  className?: string;
};

const DEFAULT_CENTER: [number, number] = [21.028511, 105.804817]; // Hà Nội

function parseCoord(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function MapClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function PinLocationPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange,
  className = "",
}: PinLocationPickerProps) {
  const parsedLat = parseCoord(latitude);
  const parsedLng = parseCoord(longitude);
  const markerPosition =
    parsedLat !== null && parsedLng !== null ? [parsedLat, parsedLng] : null;
  const center = useMemo<[number, number]>(
    () => (markerPosition ? markerPosition : DEFAULT_CENTER),
    [markerPosition]
  );

  const radius = useMemo(() => {
    const parsed = Number.parseFloat(radiusMeters);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [radiusMeters]);

  const markerIcon = useMemo(() => {
    const html = renderToStaticMarkup(
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
        <MapPin className="h-4 w-4" />
      </div>
    );

    return L.divIcon({
      html,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 28],
      popupAnchor: [0, -28],
    });
  }, []);

  const handleSelect = useCallback(
    (lat: number, lng: number) => {
      onChange(lat.toFixed(6), lng.toFixed(6));
    },
    [onChange]
  );

  return (
    <div className={className}>
      <div className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
        <div className="h-64 w-full bg-zinc-200 dark:bg-zinc-800">
          <MapContainer
            center={center}
            zoom={markerPosition ? 13 : 5}
            style={{ width: "100%", height: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            <MapClickHandler onSelect={handleSelect} />

            {markerPosition && (
              <>
                <Marker position={markerPosition} icon={markerIcon} />
                {radius > 0 && (
                  <Circle
                    center={markerPosition}
                    radius={radius}
                    pathOptions={{
                      color: "#10b981",
                      fillColor: "#10b981",
                      fillOpacity: 0.2,
                    }}
                  />
                )}
              </>
            )}
          </MapContainer>
        </div>
      </div>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Nhấn vào bản đồ để tự động điền vĩ độ và kinh độ. Bạn vẫn có thể chỉnh
        sửa thủ công bên dưới.
      </p>

      {markerPosition && (
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Vị trí đã chọn: {markerPosition[0].toFixed(6)},{" "}
          {markerPosition[1].toFixed(6)}
        </div>
      )}
    </div>
  );
}

export default PinLocationPicker;


