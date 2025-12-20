import { getJson, postFormData, delJson } from "@/lib/api-core";

export type AssetKind = "image" | "audio";

export interface UserAsset {
  id: string;
  name: string;
  url: string;
  type: AssetKind;
  mimeType?: string; 
  size: number; // bytes
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
  mimeType?: string;
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

function unwrap<T>(raw: any): T {
  if (raw && typeof raw === "object") {
    if ("value" in raw) return raw.value as T;
    if ("data" in raw) return raw.data as T;
    if ("result" in raw) return raw.result as T;
  }
  return raw as T;
}

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
    mimeType: dto.mimeType ?? dto.type,
    size: dto.size,
    createdAt: dto.createdAt,
  };
}


export async function getUserAssets(
  params: GetUserAssetsParams = {}
): Promise<PagedUserAssets> {
  const { type, page = 1, pageSize = 50 } = params;

  const safePage = Math.max(1, page);

  const safePageSize = Math.max(1, pageSize);

  const qs = new URLSearchParams();
  if (type) qs.set("type", type);
  qs.set("page", String(safePage));
  qs.set("pageSize", String(safePageSize));

  const raw = await getJson<any>(`/assets?${qs.toString()}`);
  const dto = unwrap<any>(raw);

  if (Array.isArray(dto)) {
    const list = (dto as UserAssetDto[]).map(normalizeAsset);
    return {
      assets: list,
      totalCount: list.length,
      page: safePage,
      pageSize: safePageSize,
      totalPages: list.length ? 1 : 0,
    };
  }

  const paged = dto as PagedUserAssetsDto;

  return {
    assets: (paged.assets ?? []).map(normalizeAsset),
    totalCount: paged.totalCount ?? 0,
    page: paged.page ?? safePage,
    pageSize: paged.pageSize ?? safePageSize,
    totalPages: paged.totalPages ?? 0,
  };
}

export async function uploadUserAsset(
  file: File,
  type: AssetKind = "image"
): Promise<UserAsset> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const raw = await postFormData<any>("/assets/upload", formData);
  const dto = unwrap<UserAssetDto>(raw);

  return normalizeAsset(dto);
}

export async function deleteUserAsset(assetId: string): Promise<void> {
  return delJson(`/assets/${encodeURIComponent(assetId)}`);
}
