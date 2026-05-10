import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/profile/photo — serves the photo as a binary image response
// Use ?v={photoUpdatedAt} in the URL for cache busting
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.id === "super-admin") {
      return new Response(null, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profilePhoto: true },
    });

    if (!user?.profilePhoto) {
      return new Response(null, { status: 404 });
    }

    const match = user.profilePhoto.match(/^data:(.+);base64,(.+)$/);
    if (!match) return new Response(null, { status: 404 });

    const mimeType = match[1];
    const imageData = Buffer.from(match[2], "base64");

    return new Response(imageData, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[profile/photo GET]", err);
    return new Response(null, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.id === "super-admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { profilePhoto: dataUrl },
      select: { updatedAt: true },
    });

    return NextResponse.json({ success: true, photoUpdatedAt: updated.updatedAt.getTime() });
  } catch (err) {
    console.error("[profile/photo POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.id === "super-admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { profilePhoto: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[profile/photo DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
