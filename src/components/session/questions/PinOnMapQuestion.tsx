"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useMapEvents } from "react-leaflet";
import type { SessionQuestion } from "@/types/session";

// Dynamically import Leaflet components (client-side only)
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Circle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false }
);

interface PinOnMapQuestionProps {
  question: SessionQuestion;
  onAnswer: (latitude: number, longitude: number) => void;
  disabled?: boolean;
  submittedLatitude?: number | null;
  submittedLongitude?: number | null;
  showCorrect?: boolean;
  className?: string;
}

function MapClickHandler({
  onMapClick,
  disabled,
}: {
  onMapClick: (lat: number, lng: number) => void;
  disabled: boolean;
}) {
  useMapEvents({
    click: (e) => {
      if (!disabled) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export function PinOnMapQuestion({
  question,
  onAnswer,
  disabled = false,
  submittedLatitude = null,
  submittedLongitude = null,
  showCorrect = false,
  className = "",
}: PinOnMapQuestionProps) {
  const [selectedPosition, setSelectedPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(
    submittedLatitude !== null && submittedLongitude !== null
      ? { lat: submittedLatitude, lng: submittedLongitude }
      : null
  );

  const [mapCenter] = useState<[number, number]>([
    question.correctLatitude || 10.762622,
    question.correctLongitude || 106.660172,
  ]);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!disabled) {
        setSelectedPosition({ lat, lng });
      }
    },
    [disabled]
  );

  const handleSubmit = () => {
    if (selectedPosition && !disabled) {
      onAnswer(selectedPosition.lat, selectedPosition.lng);
    }
  };

  const handleClear = () => {
    if (!disabled) {
      setSelectedPosition(null);
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const distance =
    showCorrect &&
    selectedPosition &&
    question.correctLatitude &&
    question.correctLongitude
      ? calculateDistance(
          selectedPosition.lat,
          selectedPosition.lng,
          question.correctLatitude,
          question.correctLongitude
        )
      : null;

  const isWithinRadius =
    distance !== null &&
    question.acceptanceRadiusMeters !== null &&
    distance <= (question.acceptanceRadiusMeters ?? 100);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Question Text */}
      <div className="text-xl font-semibold text-center text-gray-900 dark:text-gray-100">
        {question.questionText}
      </div>

      {/* Question Image */}
      {question.questionImageUrl && (
        <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden">
          <img
            src={question.questionImageUrl}
            alt="Question"
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📍</span>
          <div className="flex-1">
            <div className="font-semibold text-blue-700 dark:text-blue-300">
              Pin the Location
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              Click on the map to place your pin where you think the answer is
              located.
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative w-full h-96 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom={!disabled}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <MapClickHandler onMapClick={handleMapClick} disabled={disabled} />

          {/* User's Pin */}
          {selectedPosition && (
            <Marker position={[selectedPosition.lat, selectedPosition.lng]} />
          )}

          {/* Correct Location (after submission) */}
          {showCorrect &&
            question.correctLatitude &&
            question.correctLongitude && (
              <>
                <Marker
                  position={[question.correctLatitude, question.correctLongitude]}
                />
                {question.acceptanceRadiusMeters && (
                  <Circle
                    center={[
                      question.correctLatitude,
                      question.correctLongitude,
                    ]}
                    radius={question.acceptanceRadiusMeters}
                    pathOptions={{
                      color: "green",
                      fillColor: "green",
                      fillOpacity: 0.2,
                    }}
                  />
                )}
              </>
            )}
        </MapContainer>
      </div>

      {/* Selected Position Info */}
      {selectedPosition && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
          <div className="font-medium text-gray-700 dark:text-gray-300">
            Selected Position:
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            Latitude: {selectedPosition.lat.toFixed(6)}, Longitude:{" "}
            {selectedPosition.lng.toFixed(6)}
          </div>
        </div>
      )}

      {/* Distance Feedback (after submission) */}
      {showCorrect && distance !== null && (
        <div
          className={`p-4 rounded-lg border ${
            isWithinRadius
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          }`}
        >
          <div
            className={`font-semibold ${isWithinRadius ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}
          >
            {isWithinRadius ? "✓ Correct!" : "✗ Incorrect"}
          </div>
          <div
            className={`text-sm ${isWithinRadius ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            Your pin is {distance.toFixed(0)} meters from the correct location
            {question.acceptanceRadiusMeters &&
              ` (within ${question.acceptanceRadiusMeters}m is accepted)`}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!showCorrect && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClear}
            disabled={!selectedPosition || disabled}
            className="
              px-6 py-3
              bg-gray-200 hover:bg-gray-300
              dark:bg-gray-700 dark:hover:bg-gray-600
              disabled:bg-gray-100 dark:disabled:bg-gray-800
              text-gray-700 dark:text-gray-300
              font-semibold
              rounded-lg
              transition-colors
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            Clear Pin
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedPosition || disabled}
            className="
              flex-1 px-8 py-3
              bg-blue-600 hover:bg-blue-700
              disabled:bg-gray-300 dark:disabled:bg-gray-700
              text-white font-semibold text-lg
              rounded-lg
              transition-colors
              disabled:cursor-not-allowed
            "
          >
            {disabled ? "Submitted" : "Submit Location"}
          </button>
        </div>
      )}

      {/* Hint */}
      {question.hintText && !showCorrect && (
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
            💡 Need a hint?
          </summary>
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            {question.hintText}
          </div>
        </details>
      )}

      {/* Explanation */}
      {showCorrect && question.explanation && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
          <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
            📖 Explanation:
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            {question.explanation}
          </div>
        </div>
      )}
    </div>
  );
}

