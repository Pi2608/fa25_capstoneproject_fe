import { Suspense } from "react";
import Loading from "@/app/loading";

export async function generateStaticParams() {
  // For static export, we'll return an empty array
  // Dynamic routes will be handled client-side
  return [];
}

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<Loading />}>
      {children}
    </Suspense>
  );
}
