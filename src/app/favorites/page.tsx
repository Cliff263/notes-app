import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";

export const metadata: Metadata = { title: "Favorites" };

export default function FavoritesPage() {
  return <Workspace filter={{ kind: "favorites" }} />;
}
