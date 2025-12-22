import * as L from 'leaflet';

declare module 'leaflet' {
  namespace imageOverlay {
    function rotated(
      imageUrl: string | HTMLImageElement | HTMLCanvasElement,
      topleft: L.LatLngExpression,
      topright: L.LatLngExpression,
      bottomleft: L.LatLngExpression,
      options?: L.ImageOverlayOptions
    ): L.ImageOverlay;
  }

  interface ImageOverlay {
    reposition(
      topleft: L.LatLngExpression,
      topright: L.LatLngExpression,
      bottomleft: L.LatLngExpression
    ): void;
  }
}
