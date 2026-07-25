import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";

export const metadata: Metadata = { title: "Favorites · Square Notes" };

export default function FavoritesPage() {
  return <Workspace filter={{ kind: "favorites" }} />;
}
