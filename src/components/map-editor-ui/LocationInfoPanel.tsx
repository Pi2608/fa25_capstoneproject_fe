"use client";

import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LocationInfoPanelProps {
  locationId: string;
  title: string;
  subtitle?: string;
  content?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LocationInfoPanel({
  locationId,
  title,
  subtitle,
  content,
  isOpen,
  onClose,
}: LocationInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (panelRef.current) {
      if (isOpen) {
        gsap.fromTo(
          panelRef.current,
          { x: 360 },
          { x: 0, ease: "ease" }
        );
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        x: 360,
        ease: "none",
        onComplete: () => {
          setIsExpanded(false);
          onClose();
        },
      });
    } else {
      setIsExpanded(false);
      onClose();
    }
  };

  const handleExpand = () => {
    if (panelRef.current) {
      gsap.set(panelRef.current, { x: 0 });
    }
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    if (panelRef.current) {
      gsap.set(panelRef.current, { x: 0 });
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed bg-zinc-900/95 backdrop-blur-lg border-l border-zinc-800 overflow-y-auto top-10 bottom-[250px] z-[1400] transition-all duration-200 ${
          isExpanded
            ? "right-0 left-0 w-full max-w-3xl mx-auto rounded-lg border border-zinc-700"
            : "right-0 w-[360px] rounded-tl-lg rounded-bl-lg"
        }`}
        style={{
          transform: "translateX(360px)",
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:map-marker-outline" className="w-5 h-5 text-zinc-400" />
            <h3 className="font-semibold text-sm text-zinc-200">Location Info</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Expand/Collapse button */}
            {!isExpanded ? (
              <button
                onClick={handleExpand}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
                title="Chi tiết"
              >
                <Icon icon="mdi:arrow-expand" className="w-5 h-5 text-zinc-400" />
              </button>
            ) : (
              <button
                onClick={handleCollapse}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
                title="Thu gọn"
              >
                <Icon icon="mdi:arrow-collapse" className="w-5 h-5 text-zinc-400" />
              </button>
            )}
            {/* Close button - only show when not expanded */}
            {!isExpanded && (
              <button
                onClick={handleClose}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
                title="Đóng"
              >
                <Icon icon="mdi:close" className="w-5 h-5 text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Title & Subtitle */}
          <div>
            <h4 className="text-lg font-bold text-zinc-100 leading-tight mb-2">
              {title}
            </h4>
            {subtitle && (
              <p className="text-sm text-zinc-400 mb-3">{subtitle}</p>
            )}
          </div>

          {/* Content */}
          {content && (
            <div className="border-t border-zinc-800 pt-4">
              <div className="text-sm text-zinc-300 leading-relaxed prose prose-sm prose-invert max-w-none prose-img:rounded-lg prose-img:max-h-64 prose-img:w-auto prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
