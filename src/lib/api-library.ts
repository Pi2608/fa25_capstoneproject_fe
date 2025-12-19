import { getJson, postFormData, delJson } from "@/lib/api-core";

export type AssetKind = "image" | "audio";


export interface UserAsset {
  id: string;
  name: string;
  url: string;

  type: AssetKind;

  mimeType?: string;

  size: number;
  createdAt: string;
}

export interface GetUserAssetsParams {
  type?: AssetKind;
  page?: number; 
  pageSize?: number;
}

export interface PagedUserAssets {
  assets: UserAsset[];
  totalCount: number;
  page: number;    
  pageSize: number;
  totalPages: number;
}

type UserAssetDto = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
};

type PagedUserAssetsDto = {
  assets: UserAssetDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function normalizeAsset(dto: UserAssetDto): UserAsset {
  const raw = (dto.type ?? "").toLowerCase();

  const kind: AssetKind =
    raw.startsWith("image") ? "image" :
    raw.startsWith("audio") ? "audio" :
    (raw === "image" || raw === "audio") ? (raw as AssetKind) :
    "image";

  return {
    id: dto.id,
    name: dto.name,
    url: dto.url,
    type: kind,
    mimeType: dto.type,
    size: dto.size,
    createdAt: dto.createdAt,
  };
}

export async function getUserAssets(params: GetUserAssetsParams = {}): Promise<PagedUserAssets> {
  const {
    type,
    page = 1,      
    pageSize = 50,
  } = params;

  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);

  const qs = new URLSearchParams();
  if (type) qs.set("type", type);
  qs.set("page", String(safePage));
  qs.set("pageSize", String(safePageSize));

  const dto = await getJson<PagedUserAssetsDto>(`/assets?${qs.toString()}`);

  return {
    assets: (dto.assets ?? []).map(normalizeAsset),
    totalCount: dto.totalCount ?? 0,
    page: dto.page ?? safePage,
    pageSize: dto.pageSize ?? safePageSize,
    totalPages: dto.totalPages ?? 0,
  };
}

export async function uploadUserAsset(
  file: File,
  type: AssetKind = "image"
): Promise<UserAsset> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const dto = await postFormData<UserAssetDto>("/assets/upload", formData);
  return normalizeAsset(dto);
}

export async function deleteUserAsset(assetId: string): Promise<void> {
  return delJson(`/assets/${encodeURIComponent(assetId)}`);
}
