export function checkedQueries<T extends readonly { error?: unknown }[]>(
  results: T,
): T {
  if (results.some((result) => result.error))
    throw new Error("Administrative data could not be loaded. Please retry.");
  return results;
}

export function checkedQuery<T extends { error?: unknown }>(result: T): T {
  if (result.error) {
    const error = result.error;
    throw new Error(
      typeof error === "object" && "message" in error
        ? String(error.message)
        : "Administrative request failed.",
    );
  }
  return result;
}
