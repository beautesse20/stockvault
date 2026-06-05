import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const filename = searchParams.get("filename") || "photo.jpg";

  if (!url) return NextResponse.json({ error: "URL manquante" }, { status: 400 });

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}