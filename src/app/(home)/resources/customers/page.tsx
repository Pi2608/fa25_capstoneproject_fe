import type { Metadata } from "next";
import CustomersClient from "../customers/CustomersClient";

export const metadata: Metadata = {
  title: "Customers — CustomMapOSM",
  description:
    "Stories from schools and teams using CustomMapOSM to create interactive lesson maps and story maps.",
};

export default function Page() {
  return <CustomersClient />;
}
