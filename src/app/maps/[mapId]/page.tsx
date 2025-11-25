import EditMapClient from "./EditMapPage";

export default function Page({ params }: { params: { id: string } }) {
  return <EditMapClient id={params.id} />;
}
