// Lazy load Leaflet to avoid SSR issues
let L: typeof import("leaflet") | null = null;

const getLeaflet = async () => {
  if (typeof window === 'undefined') return null;
  if (!L) {
    L = (await import("leaflet")).default;
  }
  return L;
};

export const getCustomMarkerIcon = async () => {
  const Leaflet = await getLeaflet();
  if (!Leaflet) return null;
  
  return Leaflet.divIcon({
    className: 'custom-marker-icon',
    html: '<div style="width: 12px; height: 12px; background-color: white; border: 1px solid #ccc; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><div style="width: 4px; height: 4px; background-color: #3388ff; border-radius: 50%;"></div></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

export const getCustomDefaultIcon = async () => {
  const Leaflet = await getLeaflet();
  if (!Leaflet) return null;
  
  return Leaflet.divIcon({
    className: 'custom-default-marker',
    html: '<div style="width: 12px; height: 12px; background-color: white; border: 1px solid #ccc; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><div style="width: 4px; height: 4px; background-color: #3388ff; border-radius: 50%;"></div></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};
