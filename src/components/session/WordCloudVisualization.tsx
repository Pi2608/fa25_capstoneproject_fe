"use client";

import { useEffect, useState, useMemo } from "react";
import type { WordCloudData } from "@/types/session";

interface WordCloudVisualizationProps {
  data: WordCloudData[];
  maxWords?: number;
  className?: string;
}

export function WordCloudVisualization({
  data,
  maxWords = 50,
  className = "",
}: WordCloudVisualizationProps) {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Sort by frequency and take top words
  const sortedData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxWords);
  }, [data, maxWords]);

  // Calculate font sizes
  const wordsWithSizes = useMemo(() => {
    if (sortedData.length === 0) return [];

    const maxFreq = Math.max(...sortedData.map((w) => w.frequency));
    const minFreq = Math.min(...sortedData.map((w) => w.frequency));
    const freqRange = maxFreq - minFreq || 1;

    return sortedData.map((word) => {
      // Scale font size between 1rem and 4rem based on frequency
      const normalized = (word.frequency - minFreq) / freqRange;
      const fontSize = 1 + normalized * 3; // 1rem to 4rem

      // Also calculate color intensity
      const colorIntensity = 50 + normalized * 50; // 50% to 100% opacity

      return {
        ...word,
        fontSize,
        colorIntensity,
      };
    });
  }, [sortedData]);

  // Generate random positions in a cloud-like layout
  const wordsWithPositions = useMemo(() => {
    return wordsWithSizes.map((word, index) => {
      // Spiral layout algorithm
      const angle = index * 0.5;
      const radius = Math.sqrt(index + 1) * 20;
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);

      return {
        ...word,
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(5, Math.min(95, y)),
      };
    });
  }, [wordsWithSizes]);

  const colors = [
    "text-blue-600",
    "text-purple-600",
    "text-pink-600",
    "text-indigo-600",
    "text-cyan-600",
    "text-teal-600",
    "text-green-600",
    "text-orange-600",
  ];

  if (data.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-12 bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}
      >
        <div className="text-4xl mb-3">☁️</div>
        <div className="text-lg font-medium text-gray-600 dark:text-gray-400">
          No responses yet
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          The word cloud will appear as students submit their answers
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <span>☁️</span>
          <span>Word Cloud</span>
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {data.reduce((sum, w) => sum + w.frequency, 0)} total responses
        </div>
      </div>

      {/* Word Cloud Container */}
      <div className="relative w-full h-96 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        {wordsWithPositions.map((word, index) => (
          <div
            key={`${word.word}-${index}`}
            className={`
              absolute whitespace-nowrap font-bold cursor-default
              transition-all duration-1000 ease-out
              ${colors[index % colors.length]}
              ${isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-0"}
              hover:scale-110 hover:z-10
            `}
            style={{
              left: `${word.x}%`,
              top: `${word.y}%`,
              transform: `translate(-50%, -50%)`,
              fontSize: `${word.fontSize}rem`,
              opacity: word.colorIntensity / 100,
              transitionDelay: `${index * 50}ms`,
            }}
            title={`${word.word}: ${word.frequency} mention${word.frequency !== 1 ? "s" : ""}`}
          >
            {word.word}
          </div>
        ))}
      </div>

      {/* Top Words List */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Top 10 Words
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {sortedData.slice(0, 10).map((word, index) => (
            <div
              key={`top-${word.word}-${index}`}
              className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
            >
              <span className="font-medium text-sm truncate flex-1">
                {word.word}
              </span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 ml-2">
                {word.frequency}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Compact word cloud for small spaces
export function CompactWordCloud({
  data,
  maxWords = 20,
  className = "",
}: WordCloudVisualizationProps) {
  const sortedData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxWords);
  }, [data, maxWords]);

  if (data.length === 0) {
    return (
      <div className={`text-center text-gray-500 dark:text-gray-400 ${className}`}>
        <div className="text-2xl">☁️</div>
        <div className="text-xs mt-1">No data</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {sortedData.map((word, index) => {
        const maxFreq = Math.max(...sortedData.map((w) => w.frequency));
        const size = word.frequency === maxFreq ? "text-base" : "text-sm";

        return (
          <span
            key={`compact-${word.word}-${index}`}
            className={`px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium ${size}`}
            title={`${word.frequency} mentions`}
          >
            {word.word}
          </span>
        );
      })}
    </div>
  );
}

