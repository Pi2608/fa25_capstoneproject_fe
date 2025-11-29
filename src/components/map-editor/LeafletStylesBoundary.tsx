"use client";

import dynamic from "next/dynamic";
import { FullScreenLoading } from "@/components/common/FullScreenLoading";

const LeafletStylesClient = dynamic(() => import("./LeafletStylesClient"), {
  ssr: false,
  loading: () => <FullScreenLoading />,
});

export function LeafletStylesBoundary() {
  return <LeafletStylesClient />;
}

