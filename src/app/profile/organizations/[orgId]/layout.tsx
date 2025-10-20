export async function generateStaticParams() {
  // For static export, we'll return an empty array
  // Dynamic routes will be handled client-side
  return [];
}

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
