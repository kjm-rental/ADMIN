import { z } from "zod";
import { getFreshAdminSession } from "@/lib/auth";
import { loadRentalContract } from "@/services/rental-contract";
import { renderRentalContract } from "@/lib/contracts/pdf";
import { ContractUnavailable } from "@/lib/contracts/terms";
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getFreshAdminSession();
  if (!session)
    return Response.json(
      { error: "Administrator access required." },
      { status: 401, headers: privateHeaders },
    );
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return Response.json(
      { error: "Invalid booking." },
      { status: 400, headers: privateHeaders },
    );
  try {
    const contract = await loadRentalContract(session.supabase, id.data);
    if (!contract)
      return Response.json(
        { error: "Booking not found." },
        { status: 404, headers: privateHeaders },
      );
    const bytes = await renderRentalContract(contract);
    const reference =
      contract.booking.booking_reference
        .replace(/[^A-Za-z0-9_-]/g, "_")
        .slice(0, 100) || id.data;
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="KJM-Rental-Contract-${reference}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ContractUnavailable
            ? error.message
            : "The rental contract could not be downloaded. Please try again.",
      },
      {
        status: error instanceof ContractUnavailable ? 409 : 503,
        headers: privateHeaders,
      },
    );
  }
}
