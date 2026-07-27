import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";

export const metadata: Metadata = { title: "Trash" };

export default function TrashPage() {
  return <Workspace filter={{ kind: "trash" }} />;
}
