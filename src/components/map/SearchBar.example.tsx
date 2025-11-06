/**
 * Example Usage: OSM Search Component with Debounce
 * 
 * This file shows different ways to integrate the OsmSearch component
 * into your application.
 */

import { useState } from 'react';
import { OsmSearch } from './SearchBar';
import type { OsmSearchResult } from '@/lib/api-osm';

// Example 1: Basic usage with result handling
export function BasicSearchExample() {
  const [selectedPlace, setSelectedPlace] = useState<OsmSearchResult | null>(null);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Basic Search Example</h2>
      
      <OsmSearch 
        onSelectResult={(result) => {
          setSelectedPlace(result);
          console.log('Selected place:', result);
        }}
      />

      {selectedPlace && (
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="font-medium mb-2">Selected Location:</h3>
          <p className="text-sm">{selectedPlace.displayName}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Coordinates: {selectedPlace.lat}, {selectedPlace.lon}
          </p>
        </div>
      )}
    </div>
  );
}

// Example 2: Integration with map component
export function MapSearchExample() {
  const [mapCenter, setMapCenter] = useState<[number, number]>([10.8142, 106.6438]);
  const [zoom, setZoom] = useState(13);

  const handlePlaceSelect = (result: OsmSearchResult) => {
    // Fly to selected location on map
    setMapCenter([result.lat, result.lon]);
    setZoom(15);
    
    // You can also use the bounding box to fit bounds:
    // if (result.boundingBox) {
    //   map.fitBounds([
    //     [result.boundingBox.minLat, result.boundingBox.minLon],
    //     [result.boundingBox.maxLat, result.boundingBox.maxLon]
    //   ]);
    // }
  };

  return (
    <div className="relative h-screen w-full">
      {/* Search overlay */}
      <div className="absolute top-4 left-4 right-4 z-50 max-w-md">
        <OsmSearch 
          onSelectResult={handlePlaceSelect}
          placeholder="Search for a location..."
        />
      </div>

      {/* Map component would go here */}
      <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        <p className="text-gray-500">
          Map centered at: {mapCenter[0].toFixed(4)}, {mapCenter[1].toFixed(4)} (Zoom: {zoom})
        </p>
      </div>
    </div>
  );
}

// Example 3: Custom configuration
export function CustomConfigExample() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold mb-4">Custom Configuration Examples</h2>

      {/* Default search (2 second delay) */}
      <div>
        <h3 className="text-sm font-medium mb-2">Default Search (2s delay)</h3>
        <OsmSearch 
          placeholder="Default debounce..."
        />
      </div>

      {/* Faster search (500ms delay) */}
      <div>
        <h3 className="text-sm font-medium mb-2">Faster Search (500ms delay)</h3>
        <OsmSearch 
          debounceDelay={500}
          placeholder="Type quickly..."
        />
      </div>

      {/* Shorter minimum query length */}
      <div>
        <h3 className="text-sm font-medium mb-2">Search from 2 characters</h3>
        <OsmSearch 
          minQueryLength={2}
          placeholder="Shorter queries allowed..."
        />
      </div>
    </div>
  );
}

// Example 4: With form integration
export function FormIntegrationExample() {
  const [formData, setFormData] = useState({
    name: '',
    location: null as OsmSearchResult | null,
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    alert(`Location: ${formData.location?.displayName || 'Not selected'}`);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Event Registration Form</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Event Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Location *
          </label>
          <OsmSearch 
            onSelectResult={(result) => {
              setFormData(prev => ({ ...prev, location: result }));
            }}
            placeholder="Search for event location..."
          />
          {formData.location && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              ✓ Selected: {formData.location.displayName}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-2 border rounded-lg"
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={!formData.location}
          className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg 
                   hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

// Example 5: With location-based search (search near a point)
export function NearbySearchExample() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(5000); // 5km

  const getUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Could not get your location');
        }
      );
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Search Near Me</h2>
      
      <div className="mb-4">
        <button
          onClick={getUserLocation}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          📍 Get My Location
        </button>
        
        {userLocation && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
            ✓ Location acquired: {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
          </p>
        )}
      </div>

      {userLocation && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Search radius: {searchRadius}m
            </label>
            <input
              type="range"
              min="500"
              max="50000"
              step="500"
              value={searchRadius}
              onChange={(e) => setSearchRadius(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <OsmSearch 
            placeholder="Search places near you..."
            onSelectResult={(result) => {
              console.log('Found near you:', result);
            }}
          />
          
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Note: To enable location-based filtering, you would need to modify
            the OsmSearch component to accept lat/lon/radius props and pass them
            to the searchOsm() function.
          </p>
        </div>
      )}
    </div>
  );
}
