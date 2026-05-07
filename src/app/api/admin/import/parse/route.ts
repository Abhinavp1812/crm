import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseFile } from "@/lib/parseFile";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const wb = await parseFile(buffer, file.name);

    return NextResponse.json({
      filename: file.name,
      sheets: wb.sheets.map((s) => ({
        name: s.sheetName,
        headers: s.headers,
        rowCount: s.rows.length,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Parse failed: ${message}` }, { status: 500 });
  }
}