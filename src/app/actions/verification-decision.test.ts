import { beforeEach, describe, expect, it, vi } from "vitest";
import { verificationAttestation } from "@/lib/verification-attestation";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
import { decideVerification } from "./verification-decision";
const id = "00000000-0000-4000-8000-000000000001";
const v = {
  id,
  booking_id: id,
  customer_type: "local",
  identity_status: "submitted",
  license_status: "submitted",
  entitlement_status: "submitted",
  international_status: "not_applicable",
};
let documents: { id: string; document_kind: string }[];
const form = (extra: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    verificationId: id,
    bookingId: id,
    result: "approved",
    attestation: verificationAttestation,
    ...extra,
  }))
    data.set(key, value);
  for (const d of documents) data.append("documentVersion", d.id);
  return data;
};
beforeEach(() => {
  vi.clearAllMocks();
  documents = [
    { id: "identity", document_kind: "government_id" },
    { id: "license", document_kind: "drivers_license_front" },
  ];
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: v, error: null }),
      is: vi.fn().mockImplementation(async () => ({
        data: table === "verification_documents" ? documents : null,
        error: null,
      })),
    };
    return query;
  });
  mocks.session.mockResolvedValue({
    supabase: { from: mocks.from, rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({ error: null });
});
describe("concise authorized verification decisions", () => {
  it("requires an explicit full attestation before any database access", async () => {
    await expect(decideVerification(form({ attestation: "" }))).rejects.toThrow(
      "attestation",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("rejects expired administrator sessions", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(decideVerification(form())).rejects.toThrow("administrator");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("records the actual explicit attestation for all mandatory local categories", async () => {
    await expect(decideVerification(form())).rejects.toThrow("REDIRECT:");
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_review_type)).toEqual([
      "identity",
      "license",
      "entitlement",
    ]);
    for (const [name, args] of mocks.rpc.mock.calls) {
      expect(name).toBe("admin_review_verification");
      expect(args.p_reason).toContain(verificationAttestation);
      expect(args.p_result).toBe("approved");
    }
    expect(mocks.from.mock.calls.map((call) => call[0])).not.toContain(
      "bookings",
    );
  });
  it("blocks approval when a required upload is missing", async () => {
    documents = documents.slice(0, 1);
    await expect(decideVerification(form())).rejects.toThrow("missing");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires reasons for corrections and rejection", async () => {
    await expect(
      decideVerification(form({ result: "rejected", reason: "" })),
    ).rejects.toThrow("reason");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects documents outside the verification's current uploads", async () => {
    await expect(
      decideVerification(
        form({
          result: "resubmission_required",
          reason: "Unreadable",
          documentId: "someone-else",
        }),
      ),
    ).rejects.toThrow("current document");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("routes a photo request to the actual document category", async () => {
    await expect(
      decideVerification(
        form({
          result: "resubmission_required",
          reason: "Unreadable",
          documentId: "license",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_review_type: "license",
      p_result: "resubmission_required",
      p_reason: "Document: drivers license front · Unreadable",
    });
  });
  it("blocks decisions on uploads replaced since the reviewer opened the page", async () => {
    const data = form();
    documents = [
      { id: "replacement", document_kind: "government_id" },
      documents[1],
    ];
    await expect(decideVerification(data)).rejects.toThrow("Documents changed");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("stops on database rejection and does not continue approving", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "denied" } });
    await expect(decideVerification(form())).rejects.toThrow(
      "earlier categories may have been saved",
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
