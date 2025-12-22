const ICON_EMOJI_MAP: Record<string, string> = {
  car: "🚗",
  walking: "🚶",
  bike: "🚴",
  plane: "✈️",
  bus: "🚌",
  train: "🚆",
  motorcycle: "🏍️",
  boat: "⛵",
  truck: "🚛",
  helicopter: "🚁",
  custom: "📍",
};

export function generateIconHtml(
  iconType: string,
  options?: {
    size?: number;
    color?: string;
    dropShadow?: string;
  }
): string {
  const emoji = ICON_EMOJI_MAP[iconType] || ICON_EMOJI_MAP.car;

  return `<div style="font-size: 24px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${emoji}</div>`;
}
