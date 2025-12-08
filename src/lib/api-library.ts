import { getJson, postFormData, delJson } from "@/lib/api-core";

export interface UserAsset {
    id: string;
    name: string;
    url: string;
    type: "image" | "audio";
    size: number;
    createdAt: string;
}

export async function getUserAssets(type?: "image" | "audio"): Promise<UserAsset[]> {
    const query = type ? `?type=${type}` : "";
    return getJson<UserAsset[]>(`/assets${query}`);
}

export async function uploadUserAsset(file: File, type: "image" | "audio" = "image"): Promise<UserAsset> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    return postFormData<UserAsset>("/assets/upload", formData);
}

export async function deleteUserAsset(assetId: string): Promise<void> {
    return delJson(`/assets/${assetId}`);
}
