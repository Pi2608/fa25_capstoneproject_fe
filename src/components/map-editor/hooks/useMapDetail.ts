"use client";

import { useState, useEffect } from "react";
import { getMapDetail, MapDetail } from "@/lib/api-maps";
import type { BaseKey } from "../types/mapTypes";

export function useMapDetail(mapId: string) {
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [baseKey, setBaseKey] = useState<BaseKey>("osm");

  useEffect(() => {
    if (!mapId) return;
    let alive = true;
    
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const m = await getMapDetail(mapId);
        if (!alive) return;

        setDetail(m);
        setName(m.mapName ?? "");
        setDescription(m.description ?? "");
        setBaseKey(
          m.baseMapProvider === "Satellite"
            ? "sat"
            : m.baseMapProvider === "Dark"
              ? "dark"
              : "osm"
        );
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Không tải được bản đồ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    
    return () => {
      alive = false;
    };
  }, [mapId]);

  return {
    detail,
    setDetail,
    loading,
    err,
    name,
    setName,
    description,
    setDescription,
    baseKey,
    setBaseKey
  };
}
