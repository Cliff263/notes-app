import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { buildExport, slugify } from "@/lib/export";
import { serializeNote } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const requested = new URL(request.url).searchParams.get("format") ?? "pdf";
    if (!EXPORT_FORMATS.includes(requested as ExportFormat)) {
      return Response.json({ error: "Unsupported export format" }, { status: 400 });
    }

    const [row] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    if (!row) return Response.json({ error: "Note not found" }, { status: 404 });

    const note = serializeNote(row);
    const { body, mime } = await buildExport([note], requested, note.title);
    const filename = `${slugify(note.title)}.${requested}`;

    return new Response(body as BodyInit, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
