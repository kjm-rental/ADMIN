export type AdminAccessContext = Readonly<{
  userId: string | null;
  isActiveAdmin: boolean;
}>;

export class AdminAuthorizationError extends Error {
  constructor() {
    super("Active server-verified administrator access is required.");
    this.name = "AdminAuthorizationError";
  }
}

export function assertActiveAdmin(
  context: AdminAccessContext,
): asserts context is AdminAccessContext & { userId: string } {
  if (!context.userId || !context.isActiveAdmin) {
    throw new AdminAuthorizationError();
  }
}

export async function withActiveAdmin<T>(
  context: AdminAccessContext,
  operation: (userId: string) => Promise<T>,
): Promise<T> {
  assertActiveAdmin(context);
  return operation(context.userId);
}
