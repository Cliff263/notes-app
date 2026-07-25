import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";

export const metadata: Metadata = { title: "Pinned · Square Notes" };

export default function PinnedPage() {
  return <Workspace filter={{ kind: "pinned" }} />;
}
