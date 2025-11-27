"use client";

import { useState } from "react";
import type { DeleteLayerOptions } from "@/types/layers";
import { Icon } from "@/components/map-editor-ui/Icon";

interface DeleteLayerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: DeleteLayerOptions) => Promise<void>;
  layerName: string;
  featureCount: number;
  defaultLayerId: string;
  totalLayerCount: number;
}

export default function DeleteLayerDialog({
  isOpen,
  onClose,
  onConfirm,
  layerName,
  featureCount,
  defaultLayerId,
  totalLayerCount,
}: DeleteLayerDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'delete-features' | 'move-to-default'>('move-to-default');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        action: selectedOption,
        targetLayerId: selectedOption === 'move-to-default' ? defaultLayerId : undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to delete layer:", error);
      alert("Failed to delete layer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/80">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
            <Icon icon="mdi:alert" className="w-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-amber-100">Delete Layer</h3>
            <p className="text-sm text-zinc-400">This layer contains {featureCount} feature(s)</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-300">
            You are about to delete <span className="font-semibold text-white">"{layerName}"</span>.
            What would you like to do with its {featureCount} feature(s)?
          </p>

          {/* Warning for last layer */}
          {totalLayerCount <= 1 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-200">
                ⚠️ Warning: This is your only layer. Deleting it will remove all features from the map.
              </p>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              selectedOption === 'move-to-default'
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-700 hover:border-zinc-600'
            }`}>
              <input
                type="radio"
                name="deleteOption"
                value="move-to-default"
                checked={selectedOption === 'move-to-default'}
                onChange={() => setSelectedOption('move-to-default')}
                className="mt-1 h-4 w-4 text-emerald-500 focus:ring-emerald-500"
                disabled={isSubmitting}
              />
              <div className="flex-1">
                <div className="font-medium text-zinc-200 flex items-center gap-2">
                  <Icon icon="mdi:folder-move" className="w-4 h-4 text-emerald-400" />
                  Move to Default Layer
                </div>
                <div className="text-sm text-zinc-400 mt-1">
                  Features will be preserved and moved to the Default Layer
                </div>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              selectedOption === 'delete-features'
                ? 'border-red-500 bg-red-500/10'
                : 'border-zinc-700 hover:border-zinc-600'
            }`}>
              <input
                type="radio"
                name="deleteOption"
                value="delete-features"
                checked={selectedOption === 'delete-features'}
                onChange={() => setSelectedOption('delete-features')}
                className="mt-1 h-4 w-4 text-red-500 focus:ring-red-500"
                disabled={isSubmitting}
              />
              <div className="flex-1">
                <div className="font-medium text-red-200 flex items-center gap-2">
                  <Icon icon="mdi:delete-forever" className="w-4 h-4 text-red-400" />
                  Delete All Features
                </div>
                <div className="text-sm text-zinc-400 mt-1">
                  Permanently delete all {featureCount} feature(s) in this layer
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-900/70 border-t border-zinc-800/80 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-900/20"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete Layer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
