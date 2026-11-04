import { NextResponse } from "next/server";
import { z } from "zod";
import { getFreshAdminSession } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Same-origin browser requests only; authentication and RPC authorization are checked separately.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const session = await getFreshAdminSession();
  if (!session)
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 401 },
    );
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  if (Number(request.headers.get("content-length") ?? 0) > 9 * 1024 * 1024)
    return NextResponse.json(
      { error: "Upload must be under 8 MB." },
      { status: 413 },
    );
  let path: string | undefined;
  try {
    const form = await request.formData();
    const kind = z
      .enum([
        "government_id",
        "passport",
        "drivers_license_front",
        "drivers_license_back",
        "international_driving_permit",
        "supporting_document",
      ])
      .parse(form.get("kind"));
    const file = form.get("document");
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 8388608 ||
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "application/pdf",
      ].includes(file.type)
    )
      throw Error("Choose a supported image or PDF no larger than 8 MB.");
    // Check file signatures as well as browser-supplied MIME metadata.
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const ascii = new TextDecoder("latin1").decode(bytes);
    const valid =
      file.type === "application/pdf"
        ? ascii.startsWith("%PDF-")
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : file.type === "image/png"
            ? bytes[0] === 137 && ascii.slice(1, 4) === "PNG"
            : file.type === "image/webp"
              ? ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP"
              : ascii.slice(4, 8) === "ftyp" &&
                /avif|avis/.test(ascii.slice(8));
    if (!valid)
      throw Error("File contents do not match the selected document type.");
    const { data: meta, error: metaError } = await session.supabase
      .from("booking_admin_details")
      .select("booking_id")
      .eq("booking_id", id.data)
      .maybeSingle();
    if (metaError || !meta)
      throw Error("An eligible admin booking is required.");
    path = `guest/${id.data}/${crypto.randomUUID()}`;
    const storage = session.supabase.storage.from("identity-verification");
    const upload = await storage.upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error)
      throw Error(
        "Private upload was rejected. Check booking status and document permissions.",
      );
    const rpc = session.supabase.rpc.bind(session.supabase) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
    const result = await rpc("admin_register_manual_document", {
      p_booking: id.data,
      p_kind: kind,
      p_path: path,
      p_mime: file.type,
      p_size: file.size,
    });
    if (result.error) throw Error(result.error.message);
    return NextResponse.json({ saved: true });
  } catch (e) {
    if (path)
      await session.supabase.storage
        .from("identity-verification")
        .remove([path]);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Private document upload failed.",
      },
      { status: 400 },
    );
  }
}
