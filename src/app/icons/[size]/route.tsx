import { appIcon } from "@/lib/app-icon";

/** Manifest icons, drawn rather than shipped as binaries. */
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await params;
  const size = raw === "512" ? 512 : 192;

  return appIcon(size);
}
