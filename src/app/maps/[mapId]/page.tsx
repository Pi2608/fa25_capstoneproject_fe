import EditMapClient from "./EditMapPage";

export default async function Page({ params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditMapClient id={id} />;
}