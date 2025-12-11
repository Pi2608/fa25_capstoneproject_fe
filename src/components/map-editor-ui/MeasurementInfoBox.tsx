import React from 'react';
import { X } from 'lucide-react';
import { formatDistance, formatArea } from '@/lib/measurement-utils';
import { cn } from '@/lib/utils';

interface MeasurementInfoBoxProps {
  mode: 'distance' | 'area';
  value: number; // meters or square meters
  onDismiss: () => void;
}

export function MeasurementInfoBox({
  mode,
  value,
  onDismiss,
}: MeasurementInfoBoxProps) {
  const formattedValue =
    mode === 'distance' ? formatDistance(value) : formatArea(value);

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-[1000]',
        'bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg',
        'px-4 py-3 flex items-center gap-3'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-400">
          {mode === 'distance' ? 'Distance:' : 'Area:'}
        </span>
        <span className="text-lg font-semibold text-white">
          {formattedValue}
        </span>
      </div>

      <button
        onClick={onDismiss}
        className={cn(
          'p-1 rounded hover:bg-zinc-800 transition-colors',
          'text-zinc-400 hover:text-white'
        )}
        title="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

