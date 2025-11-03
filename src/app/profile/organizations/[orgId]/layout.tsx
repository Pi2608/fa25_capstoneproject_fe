export async function generateStaticParams() {

  return [];
}

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
