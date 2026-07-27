import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { buildExport } from "@/lib/export";
import { loadExportImages } from "@/lib/export-images";
import { serializeNote } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/types";

/** Every note in one document, newest first. */
export async function GET(request: Request) {
  try {
    const userId = await requireUserId();

    const params = new URL(request.url).searchParams;
    const requested = params.get("format") ?? "pdf";
    if (!EXPORT_FORMATS.includes(requested as ExportFormat)) {
      return Response.json({ error: "Unsupported export format" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt));

    const included = rows
      .map((row) => serializeNote(row))
      .filter((note) => params.get("archived") === "true" || !note.archived);

    if (included.length === 0) {
      return Response.json({ error: "Nothing to export" }, { status: 404 });
    }

    const images = await loadExportImages(included, userId);
    const { body, mime } = await buildExport(
      included,
      requested,
      "Nexora export",
      images,
    );
    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(body as BodyInit, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="nexora-${stamp}.${requested}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
