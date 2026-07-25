import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";

export const metadata: Metadata = { title: "Archive · Square Notes" };

export default function ArchivePage() {
  return <Workspace filter={{ kind: "archive" }} />;
}
