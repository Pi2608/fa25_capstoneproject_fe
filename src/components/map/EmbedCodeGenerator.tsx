"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check, ExternalLink, Code2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareForEmbed } from "@/lib/api-maps";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n/I18nProvider";

interface EmbedCodeGeneratorProps {
  mapId: string;
  mapName: string;
  status?: string;
  isStoryMap?: boolean;
  onMapUpdated?: () => void; // Callback to reload map data
  className?: string;
}

export default function EmbedCodeGenerator({ 
  mapId, 
  mapName, 
  status,
  isStoryMap = false,
  onMapUpdated,
  className = "" 
}: EmbedCodeGeneratorProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("600px");
  const [showBorder, setShowBorder] = useState(true);
  const [embedCode, setEmbedCode] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [isReady, setIsReady] = useState(status === "published");
  const { showToast } = useToast();
  const hasPreparedRef = useRef(false);

  const handlePrepareForEmbed = async () => {
    setIsPreparing(true);
    try {
      await prepareForEmbed(mapId);
      setIsReady(true);
      if (onMapUpdated) {
        onMapUpdated(); // Reload map data to get updated status
      }
      showToast("success", "Map đã được publish để embed");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("map_components", "embed_prepare_error");
      showToast("error", message);
    } finally {
      setIsPreparing(false);
    }
  };

  // Auto prepare for embed when component mounts if not ready
  useEffect(() => {
    if (isStoryMap) return; // Don't prepare if it's a story map
    const shouldPrepare = status !== "published" && !hasPreparedRef.current;
    if (shouldPrepare && !isPreparing) {
      hasPreparedRef.current = true;
      handlePrepareForEmbed();
    } else if (status === "published") {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (isReady) {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const embedUrl = `${baseUrl}/maps/publish?mapId=${mapId}&view=true`;
      
      const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="${width}" 
  height="${height}" 
  frameborder="${showBorder ? "1" : "0"}"
  allowfullscreen
  style="border: ${showBorder ? "1px solid #ccc" : "none"}; border-radius: 8px;"
></iframe>`;

      setEmbedCode(iframeCode);
    }
  }, [mapId, width, height, showBorder, isReady]);

  // Check if map is story map - story maps cannot be embedded
  // This check is after hooks to avoid violating Rules of Hooks
  if (isStoryMap) {
    return (
      <div className={`p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg ${className}`}>
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {t("map_components", "embed_storymap_unsupported")}
        </p>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const previewUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/maps/publish?mapId=${mapId}&view=true`
    : "";

  if (isPreparing) {
    return (
      <div className={`p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${className}`}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Đang chuẩn bị map để embed (publish)...
          </p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className={`p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg ${className}`}>
        <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
          {t("map_components", "embed_not_ready")}
        </p>
        <Button
          onClick={handlePrepareForEmbed}
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          Chuẩn bị để embed
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Code2 className="h-5 w-5 text-emerald-500" />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Embed Code Generator
        </h3>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Width
            </label>
            <input
              type="text"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="100% or 800px"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Height
            </label>
            <input
              type="text"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="600px"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showBorder"
            checked={showBorder}
            onChange={(e) => setShowBorder(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
          />
          <label htmlFor="showBorder" className="text-sm text-zinc-700 dark:text-zinc-300">
            Show border
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Embed Code
        </label>
        <div className="relative">
          <textarea
            value={embedCode}
            readOnly
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          <Button
            onClick={handleCopy}
            size="sm"
            className="absolute top-2 right-2"
            variant="outline"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Preview in new tab
        </a>
      </div>
    </div>
  );
}

