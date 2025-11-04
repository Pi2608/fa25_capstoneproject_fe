/**
 * Translation utilities for OpenStreetMap types and categories
 */

// Category translations (English -> Vietnamese)
const categoryMap: Record<string, string> = {
  'place': 'Địa điểm',
  'boundary': 'Ranh giới',
  'highway': 'Đường',
  'building': 'Công trình',
  'amenity': 'Tiện ích',
  'natural': 'Tự nhiên',
  'waterway': 'Đường thủy',
  'railway': 'Đường sắt',
  'leisure': 'Giải trí',
  'historic': 'Lịch sử',
  'tourism': 'Du lịch',
  'shop': 'Cửa hàng',
  'office': 'Văn phòng',
  'landuse': 'Sử dụng đất',
  'aeroway': 'Hàng không',
  'military': 'Quân sự',
  'public_transport': 'Giao thông công cộng',
};

// Type translations (English -> Vietnamese)
const typeMap: Record<string, string> = {
  // Administrative
  'administrative': 'Hành chính',
  'country': 'Quốc gia',
  'state': 'Tỉnh/Bang',
  'region': 'Vùng',
  'province': 'Tỉnh',
  'district': 'Quận/Huyện',
  'city': 'Thành phố',
  'town': 'Thị trấn',
  'village': 'Làng/Xã',
  'hamlet': 'Xóm/Ấp',
  'suburb': 'Phường',
  'quarter': 'Khu vực',
  'neighbourhood': 'Khu phố',
  'municipality': 'Đô thị',
  
  // Transportation
  'station': 'Trạm/Ga',
  'stop': 'Điểm dừng',
  'halt': 'Điểm dừng nhỏ',
  'road': 'Đường',
  'street': 'Phố',
  'motorway': 'Đường cao tốc',
  'trunk': 'Quốc lộ',
  'primary': 'Đường chính',
  'secondary': 'Đường phụ',
  'tertiary': 'Đường cấp 3',
  'unclassified': 'Đường nhỏ',
  'residential': 'Đường nội bộ',
  'service': 'Đường dịch vụ',
  'pedestrian': 'Đường đi bộ',
  'footway': 'Lối đi bộ',
  'cycleway': 'Đường xe đạp',
  'path': 'Lối đi',
  'bridge': 'Cầu',
  'tunnel': 'Hầm',
  
  // Buildings & Places
  'building': 'Tòa nhà',
  'house': 'Nhà',
  'apartment': 'Chung cư',
  'commercial': 'Thương mại',
  'industrial': 'Công nghiệp',
  'retail': 'Bán lẻ',
  'warehouse': 'Kho bãi',
  'school': 'Trường học',
  'hospital': 'Bệnh viện',
  'clinic': 'Phòng khám',
  'university': 'Đại học',
  'college': 'Cao đẳng',
  'kindergarten': 'Mẫu giáo',
  'library': 'Thư viện',
  'theatre': 'Nhà hát',
  'cinema': 'Rạp chiếu phim',
  'museum': 'Bảo tàng',
  'gallery': 'Phòng trưng bày',
  'monument': 'Tượng đài',
  'memorial': 'Đài tưởng niệm',
  
  // Amenities
  'restaurant': 'Nhà hàng',
  'cafe': 'Quán cà phê',
  'fast_food': 'Đồ ăn nhanh',
  'bar': 'Quán bar',
  'pub': 'Quán rượu',
  'bank': 'Ngân hàng',
  'atm': 'Cây ATM',
  'post_office': 'Bưu điện',
  'police': 'Công an',
  'fire_station': 'Trạm cứu hỏa',
  'marketplace': 'Chợ',
  'supermarket': 'Siêu thị',
  'pharmacy': 'Nhà thuốc',
  'fuel': 'Trạm xăng',
  'parking': 'Bãi đỗ xe',
  'toilets': 'Nhà vệ sinh',
  'fountain': 'Đài phun nước',
  'place_of_worship': 'Nơi thờ cúng',
  'temple': 'Chùa/Đền',
  'church': 'Nhà thờ',
  'mosque': 'Nhà thờ Hồi giáo',
  'pagoda': 'Chùa',
  
  // Natural features
  'water': 'Nước',
  'river': 'Sông',
  'stream': 'Suối',
  'lake': 'Hồ',
  'pond': 'Ao',
  'reservoir': 'Hồ chứa',
  'bay': 'Vịnh',
  'beach': 'Bãi biển',
  'coastline': 'Bờ biển',
  'island': 'Đảo',
  'peninsula': 'Bán đảo',
  'peak': 'Đỉnh núi',
  'mountain': 'Núi',
  'hill': 'Đồi',
  'valley': 'Thung lũng',
  'forest': 'Rừng',
  'wood': 'Rừng nhỏ',
  'tree': 'Cây',
  'grassland': 'Đồng cỏ',
  'wetland': 'Đất ngập nước',
  'park': 'Công viên',
  'garden': 'Vườn',
  'recreation_ground': 'Khu giải trí',
  'pitch': 'Sân thể thao',
  'playground': 'Sân chơi',
  'stadium': 'Sân vận động',
  'sports_centre': 'Trung tâm thể thao',
  
  // Land use
  'farmland': 'Đất nông nghiệp',
  'meadow': 'Đồng cỏ',
  'orchard': 'Vườn cây ăn trái',
  'vineyard': 'Vườn nho',
  'cemetery': 'Nghĩa trang',
  'allotments': 'Đất canh tác',
  'quarry': 'Mỏ đá',
  'construction': 'Đang xây dựng',
};

/**
 * Translate OSM category and type to Vietnamese
 * @param category - OSM category (e.g., "place", "boundary")
 * @param type - OSM type (e.g., "city", "administrative")
 * @returns Translated string in Vietnamese
 */
export function translateOsmType(category?: string, type?: string): string {
  const translatedType = type ? typeMap[type.toLowerCase()] || type : '';
  const translatedCategory = category ? categoryMap[category.toLowerCase()] || category : '';

  if (translatedType && translatedCategory) {
    return `${translatedCategory} - ${translatedType}`;
  }
  return translatedType || translatedCategory || 'Không xác định';
}

/**
 * Get translated category only
 * @param category - OSM category
 * @returns Translated category in Vietnamese
 */
export function translateCategory(category?: string): string {
  if (!category) return 'Không xác định';
  return categoryMap[category.toLowerCase()] || category;
}

/**
 * Get translated type only
 * @param type - OSM type
 * @returns Translated type in Vietnamese
 */
export function translateType(type?: string): string {
  if (!type) return 'Không xác định';
  return typeMap[type.toLowerCase()] || type;
}
