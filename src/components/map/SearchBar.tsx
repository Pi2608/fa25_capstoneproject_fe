/**
 * Example: OSM Search Component with Debounce
 * 
 * This component demonstrates how to use useDebounce hook
 * to optimize search API calls.
 * 
 * Place this component wherever you need OSM search functionality.
 */

import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { searchOsm, type OsmSearchResult } from '@/lib/api-osm';

interface OsmSearchProps {
  onSelectResult?: (result: OsmSearchResult) => void;
  placeholder?: string;
  minQueryLength?: number;
  debounceDelay?: number;
}

export function OsmSearch({ 
  onSelectResult, 
  placeholder = "Search for places...",
  minQueryLength = 3,
  debounceDelay = 2000 
}: OsmSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OsmSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceDelay);

  // Effect to call API when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.length < minQueryLength) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults = await searchOsm(debouncedQuery, undefined, undefined, undefined, 10);
        setResults(searchResults);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, minQueryLength]);

  const handleSelectResult = (result: OsmSearchResult) => {
    setQuery(result.displayName);
    setShowResults(false);
    onSelectResult?.(result);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value.length >= minQueryLength) {
      setShowResults(true);
    }
  };

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder={placeholder}
          className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg 
                   text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                   bg-white dark:bg-gray-800"
        />
        
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}
        
        {/* Search Icon */}
        {!isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Query Status */}
      {query.length > 0 && query.length < minQueryLength && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Type at least {minQueryLength} characters to search
        </p>
      )}

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                      rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.osmType}-${result.osmId}-${index}`}
              onClick={() => handleSelectResult(result)}
              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 
                       border-b border-gray-200 dark:border-gray-700 last:border-b-0
                       transition-colors duration-150"
            >
              <div className="flex items-start gap-3">
                {/* Icon based on OSM type */}
                <div className="flex-shrink-0 mt-1">
                  {result.osmType === 'node' && (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">📍</span>
                    </div>
                  )}
                  {result.osmType === 'way' && (
                    <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
                      <span className="text-white text-xs">🛣️</span>
                    </div>
                  )}
                  {result.osmType === 'relation' && (
                    <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs">🗺️</span>
                    </div>
                  )}
                </div>

                {/* Result Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {result.displayName}
                  </p>
                  {result.category && result.type && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {result.category} • {result.type}
                    </p>
                  )}
                  {result.addressDetails && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {[
                        result.addressDetails.city,
                        result.addressDetails.state,
                        result.addressDetails.country
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>

                {/* Coordinates */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {result.lat.toFixed(4)}, {result.lon.toFixed(4)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {showResults && !isLoading && results.length === 0 && debouncedQuery.length >= minQueryLength && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                      rounded-lg shadow-lg p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No results found for "{debouncedQuery}"
          </p>
        </div>
      )}

      {/* Click outside to close */}
      {showResults && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowResults(false)}
        />
      )}
    </div>
  );
}
