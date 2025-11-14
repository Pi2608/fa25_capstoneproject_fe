"use client";

import { useEffect, useRef } from "react";

interface PoiTooltipModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  content?: string;
  x?: number;
  y?: number;
}

export function PoiTooltipModal({
  isOpen,
  onClose,
  title,
  content,
  x,
  y,
}: PoiTooltipModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Set content when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Clear content when modal closes
      if (contentRef.current) {
        contentRef.current.innerHTML = "";
      }
      return;
    }

    if (!content) {
      return;
    }

    const setContent = () => {
      if (!contentRef.current) {
        return;
      }

      const trimmed = content.trim();
      
      // Clear any existing placeholder text
      contentRef.current.innerHTML = "";

      // If content is empty after trimming, show placeholder
      if (!trimmed || trimmed.length === 0) {
        const placeholder = document.createElement("p");
        placeholder.className = "text-gray-400 italic";
        placeholder.textContent = "No content available";
        contentRef.current.appendChild(placeholder);
        return;
      }

      // Check if content contains base64 image
      const hasBase64Image = trimmed.includes("data:image") || trimmed.includes("base64");
      const hasHTML = trimmed.startsWith("<") || trimmed.includes("<");

      // Handle different content types
      if (trimmed.startsWith("data:image") && !trimmed.includes("<")) {
        // Pure base64 image (not wrapped in HTML)
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.src = trimmed;
        img.style.cssText =
          "max-width: 100% !important; height: auto !important; border-radius: 6px !important; display: block !important; margin: 0 auto !important;";
        img.alt = title || "Image";
        contentRef.current.appendChild(img);
      } else if (trimmed.startsWith("<") || trimmed.includes("<")) {
        // HTML content - check if it contains base64 images first
        
        // Check if HTML contains large base64 images
        const base64ImageMatches = trimmed.matchAll(/<img[^>]+src=["'](data:image[^"']+)["'][^>]*>/gi);
        const hasLargeBase64Images = Array.from(base64ImageMatches).some(match => {
          const src = match[1];
          return src.length > 100000; // >100KB
        });
        
        if (hasLargeBase64Images) {
          
          // Show loading state first
          const loadingDiv = document.createElement("div");
          loadingDiv.className = "flex items-center justify-center p-4";
          loadingDiv.innerHTML = `
            <div class="text-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
              <p class="text-gray-400 text-xs">Loading content...</p>
            </div>
          `;
          contentRef.current.appendChild(loadingDiv);
          
          // Process HTML asynchronously
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (!contentRef.current) return;
              
              // Remove loading
              if (loadingDiv.parentNode) {
                loadingDiv.remove();
              }
              
              // Set HTML content - this preserves all text and HTML structure
              try {
                contentRef.current.innerHTML = trimmed;
                
                // Process images in the HTML to use lazy loading (without removing text)
                const images = contentRef.current.querySelectorAll("img[src^='data:image']");
                
                images.forEach((img) => {
                  const imgElement = img as HTMLImageElement;
                  const src = imgElement.src;
                  
                  if (src.length > 100000) {
                    // Large image - add lazy loading attributes
                    imgElement.loading = "lazy";
                    imgElement.decoding = "async";
                    imgElement.style.opacity = "0";
                    imgElement.style.transition = "opacity 0.3s";
                    
                    // Load asynchronously
                    requestAnimationFrame(() => {
                      imgElement.onload = () => {
                        imgElement.style.opacity = "1";
                      };
                    });
                  } else {
                    // Small image - just add lazy loading
                    imgElement.loading = "lazy";
                    imgElement.decoding = "async";
                  }
                });
              } catch (error) {
                contentRef.current.textContent = "Failed to load content";
              }
            }, 50);
          });
        } else {
          // No large images - set directly
          try {
            contentRef.current.innerHTML = trimmed;
            
            // Verify content was set
            if (contentRef.current.innerHTML.length === 0) {
              // Fallback to DOMParser only if innerHTML fails
              try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(trimmed, "text/html");
                const bodyContent = doc.body;

                let appendedCount = 0;
                while (bodyContent.firstChild && appendedCount < 1000) { // Limit to prevent infinite loop
                  contentRef.current.appendChild(bodyContent.firstChild.cloneNode(true));
                  appendedCount++;
                }
              } catch (parseError) {
                // Last resort: set as text
                contentRef.current.textContent = trimmed;
              }
            }
          } catch (innerHTMLError) {
            // Try DOMParser as fallback
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(trimmed, "text/html");
              const bodyContent = doc.body;

              let appendedCount = 0;
              while (bodyContent.firstChild && appendedCount < 1000) {
                contentRef.current.appendChild(bodyContent.firstChild.cloneNode(true));
                appendedCount++;
              }
            } catch (parseError) {
              contentRef.current.textContent = trimmed;
            }
          }
        }
      } else {
        // Plain text
        const p = document.createElement("p");
        p.textContent = content;
        p.style.cssText =
          "margin: 0; color: #ffffff !important; font-size: 14px; line-height: 1.6;";
        contentRef.current.appendChild(p);
      }

      // Verify content was set and add fallback if needed
      setTimeout(() => {
        if (contentRef.current) {
          const hasContent = contentRef.current.innerHTML.length > 0 || 
                            contentRef.current.textContent?.trim().length > 0 ||
                            contentRef.current.children.length > 0;
          
          // If still no content, use innerHTML as final fallback
          if (!hasContent && trimmed) {
            contentRef.current.innerHTML = trimmed;
            
            // Force white text color
            const allElements = contentRef.current.querySelectorAll("*");
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.setProperty("color", "#ffffff", "important");
            });
          }
        }
      }, 100);

      // Apply styling after content is set (use requestAnimationFrame to avoid blocking)
      requestAnimationFrame(() => {
        if (!contentRef.current) return;
        
        // Force white text color on all text elements (but not on images)
        const textElements = contentRef.current.querySelectorAll("p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, strong, em, b, i, u, a, blockquote");
        textElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          // Only set color if it's not already set or is black/dark
          const currentColor = window.getComputedStyle(htmlEl).color;
          if (!currentColor || currentColor === 'rgb(0, 0, 0)' || currentColor === 'black' || 
              currentColor === 'rgba(0, 0, 0, 0)' || currentColor === 'transparent') {
            htmlEl.style.setProperty("color", "#ffffff", "important");
          }
          // Ensure display is not none
          if (window.getComputedStyle(htmlEl).display === 'none') {
            htmlEl.style.setProperty("display", "block", "important");
          }
        });

        // Style images (don't override existing styles that might be needed)
        const images = contentRef.current.querySelectorAll("img");
        images.forEach((img) => {
          // Only add styles that don't conflict
          img.style.setProperty("max-width", "100%", "important");
          img.style.setProperty("height", "auto", "important");
          img.style.setProperty("border-radius", "6px", "important");
          img.style.setProperty("margin", "8px 0", "important");
          // Don't force display: block if it's inline
          if (window.getComputedStyle(img).display === 'none') {
            img.style.setProperty("display", "block", "important");
          }
        });

        // Style links
        const links = contentRef.current.querySelectorAll("a");
        links.forEach((link) => {
          link.style.setProperty("color", "#60a5fa", "important");
          link.style.setProperty("text-decoration", "none", "important");
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        });
      });
    };

    // Set content immediately if modal is already in DOM, otherwise wait a bit
    if (contentRef.current) {
      // Modal is already in DOM, set content immediately
      setContent();
    } else {
      // Modal not in DOM yet, wait a bit
      setTimeout(setContent, 10);
    }
  }, [isOpen, content, title]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed z-[10000] bg-gray-900/98 backdrop-blur-md text-white rounded-xl shadow-2xl border border-white/15 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        style={{
          top: y ? `${y}px` : "50%",
          left: x ? `${x}px` : "50%",
          transform: x && y ? "none" : "translate(-50%, -50%)",
          margin: x && y ? "0" : undefined,
          pointerEvents: "auto",
          willChange: "transform",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">
            {title || "Tooltip Content"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-5 text-white prose prose-invert max-w-none poi-tooltip-modal-content"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255, 255, 255, 0.3) transparent",
            minHeight: "100px",
            contain: "layout style paint",
            willChange: "contents",
          }}
        >
          {!content && (
            <p className="text-gray-400 italic">No content available</p>
          )}
          {content && content.trim().length === 0 && (
            <p className="text-gray-400 italic">Content is empty</p>
          )}
        </div>
      </div>

      <style jsx global>{`
        .poi-tooltip-modal-content::-webkit-scrollbar {
          width: 6px;
        }
        .poi-tooltip-modal-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .poi-tooltip-modal-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        .poi-tooltip-modal-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </>
  );
}

