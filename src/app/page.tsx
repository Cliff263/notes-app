import { Workspace } from "@/components/workspace";

export default function AllNotesPage() {
  return <Workspace filter={{ kind: "all" }} />;
}
