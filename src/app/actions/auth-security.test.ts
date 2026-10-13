import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  signIn: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
vi.mock("@/lib/pin", () => ({
  derivePinCredential: (pin: string) => `derived-${pin}`,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Error(`REDIRECT:${url}`);
  },
}));
import { changePin } from "./auth";
const user = { id: "synthetic-admin", email: "admin@example.invalid" };
let membership: { data: unknown; error: unknown }[];
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_LOGIN_EMAIL = user.email;
  membership = [
    { data: { id: "admin", is_active: true }, error: null },
    { data: { id: "admin", is_active: true }, error: null },
  ];
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.from.mockImplementation(() => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => membership.shift()),
    };
    return chain;
  });
  mocks.create.mockResolvedValue({
    auth: {
      getUser: mocks.getUser,
      signInWithPassword: mocks.signIn,
      updateUser: mocks.update,
    },
    from: mocks.from,
  });
});
function form() {
  const data = new FormData();
  data.set("currentPin", "1234");
  data.set("newPin", "5678");
  data.set("confirmPin", "5678");
  return data;
}
it("freshly verifies active membership twice before updating the same caller", async () => {
  await expect(changePin(form())).rejects.toThrow("changed=1");
  expect(mocks.getUser).toHaveBeenCalledTimes(2);
  expect(mocks.from).toHaveBeenCalledTimes(2);
  expect(mocks.signIn).toHaveBeenCalledWith({
    email: user.email,
    password: "derived-1234",
  });
  expect(mocks.update).toHaveBeenCalledWith({ password: "derived-5678" });
  expect(mocks.from.mock.invocationCallOrder[1]).toBeLessThan(
    mocks.update.mock.invocationCallOrder[0],
  );
});
it.each(["suspended", "query error"])(
  "denies %s before PIN reauthentication",
  async (scenario) => {
    membership = [
      {
        data: null,
        error: scenario === "query error" ? { message: "failure" } : null,
      },
    ];
    await expect(changePin(form())).rejects.toThrow("not-authorized");
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  },
);
it("denies a suspension after correct current PIN verification", async () => {
  membership[1] = { data: null, error: null };
  await expect(changePin(form())).rejects.toThrow("not-authorized");
  expect(mocks.signIn).toHaveBeenCalledOnce();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("fails closed when the fresh membership lookup fails after reauthentication", async () => {
  membership[1] = { data: { id: "admin" }, error: { message: "failure" } };
  await expect(changePin(form())).rejects.toThrow("not-authorized");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("denies an unauthenticated request", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(changePin(form())).rejects.toThrow("not-authorized");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("does not switch a different administrator to the configured PIN account", async () => {
  mocks.getUser.mockResolvedValue({
    data: { user: { ...user, email: "other@example.invalid" } },
    error: null,
  });
  await expect(changePin(form())).rejects.toThrow("not-authorized");
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("denies an identity change during reauthentication", async () => {
  mocks.getUser
    .mockResolvedValueOnce({ data: { user }, error: null })
    .mockResolvedValueOnce({
      data: { user: { ...user, id: "different" } },
      error: null,
    });
  await expect(changePin(form())).rejects.toThrow("not-authorized");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("still requires the correct current PIN", async () => {
  mocks.signIn.mockResolvedValue({ error: { message: "invalid" } });
  await expect(changePin(form())).rejects.toThrow("error=current");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("still requires matching four-digit PINs", async () => {
  const data = form();
  data.set("confirmPin", "9999");
  await expect(changePin(data)).rejects.toThrow("error=invalid");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("reports an Auth update failure", async () => {
  mocks.update.mockResolvedValue({ error: { message: "failure" } });
  await expect(changePin(form())).rejects.toThrow("error=update");
});
