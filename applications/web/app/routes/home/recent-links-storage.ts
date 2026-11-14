const storageKey = "url-shortener.recent-codes.v1";

export function readRecentCodes(storage: Pick<Storage, "getItem">): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (code): code is string =>
                typeof code === "string" && code.trim().length > 0,
            ),
          ),
        ].slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

export function rememberCode(codes: string[], code: string): string[] {
  return [code, ...codes.filter((entry) => entry !== code)].slice(0, 50);
}

export function writeRecentCodes(
  storage: Pick<Storage, "setItem">,
  codes: string[],
) {
  try {
    storage.setItem(storageKey, JSON.stringify(codes));
  } catch {
    console.log("Failed to write recent codes");
    // The current page can still display history when persistence is denied.
  }
}
