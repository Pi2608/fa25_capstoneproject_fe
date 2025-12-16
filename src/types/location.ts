// Location and POI related types

export type LocationType = "PointOfInterest" | "Landmark" | "Route" | "Event"
export type LocationPoiDialogForm = {
  title: string;
  subtitle?: string;
  description?: string; // For Location
  storyContent?: string; // For POI
  locationType: LocationType;
  markerGeometry: string;
  
  // Icon styling (Location only)
  iconType?: string;
  iconUrl?: string;
  iconColor?: string;
  iconSize?: number;
  
  // Display settings
  displayOrder: number;
  highlightOnEnter?: boolean;
  isVisible?: boolean;
  zIndex?: number;
  
  // Tooltip
  showTooltip?: boolean;
  tooltipContent?: string;
  
  // Popup/Slide content
  openPopupOnClick?: boolean; // For Location
  popupContent?: string; // For Location
  openSlideOnClick?: boolean; // For POI
  slideContent?: string; // For POI
  
  // Media
  mediaUrls?: string; // For Location
  mediaResources?: string; // For POI
  
  // Audio
  playAudioOnClick?: boolean;
  audioUrl?: string;
  
  // Links
  externalUrl?: string;
  linkedSegmentId?: string; // For Location
  linkedLocationId?: string; // For Location
  
  // Animation effects
  entryEffect?: string;
  exitEffect?: string;
  entryDelayMs?: number;
  entryDurationMs?: number;
  exitDelayMs?: number;
  exitDurationMs?: number;
};

export type LocationPoiDialogMode = "location" | "poi";

