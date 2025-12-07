"use client";

import dynamic from "next/dynamic";
import Loading from "@/app/loading";

const LeafletStylesClient = dynamic(() => import("./LeafletStylesClient"), {
  ssr: false,
  loading: () => <Loading />,
});

export function LeafletStylesBoundary() {
  return <LeafletStylesClient />;
}

