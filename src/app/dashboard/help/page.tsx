import type { Metadata } from "next";
import { OwnerGuide } from "@/components/owner-guide";
export const metadata: Metadata = { title: "Owner's guide" };
export default function HelpPage() {
  return <OwnerGuide />;
}
