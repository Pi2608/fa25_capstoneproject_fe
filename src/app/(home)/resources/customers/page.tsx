import type { Metadata } from "next";
import CustomersClient from "../customers/CustomersClient";

export const metadata: Metadata = {
  title: "Customers — IMOS",
  description:
    "Stories from schools and teams using IMOS to create interactive lesson maps and story maps.",
};

export default function Page() {
  return <CustomersClient />;
}
