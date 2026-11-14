import { useEffect, useState } from "react";
import { useActionData, useFetcher, useLoaderData } from "react-router";
import type { action, loader } from "./route";
import type { loader as recentLinksLoader } from "../recent-links/route";
import { ShortenerView } from "./shortener.view";
import {
  readRecentCodes,
  rememberCode,
  writeRecentCodes,
} from "./recent-links-storage";

export function ShortenerController() {
  const { baseUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [codes, setCodes] = useState<string[]>([]);
  const recentLinks = useFetcher<typeof recentLinksLoader>();
  const { load } = recentLinks;

  useEffect(() => {
    try {
      setCodes(readRecentCodes(window.localStorage));
    } catch {
      // Access to localStorage itself can be denied by browser policy.
    }
  }, []);

  useEffect(() => {
    if (!actionData?.shortCode) return;
    setCodes((previous) => rememberCode(previous, actionData.shortCode));
  }, [actionData]);

  useEffect(() => {
    if (codes.length === 0) return;
    try {
      writeRecentCodes(window.localStorage, codes);
    } catch {
      // Keep the in-memory selection when browser storage is unavailable.
    }
    const query = new URLSearchParams();
    codes.forEach((code) => query.append("code", code));
    const refreshCounts = () => {
      void load(`/recent-links?${query}`);
    };
    refreshCounts();
    window.addEventListener("focus", refreshCounts);
    return () => window.removeEventListener("focus", refreshCounts);
  }, [codes, load]);

  return (
    <ShortenerView
      baseUrl={baseUrl}
      shortenedUrl={actionData?.shortenedUrl}
      error={actionData?.error}
      recentLinks={recentLinks.data?.links}
      recentLinksError={recentLinks.data?.error}
    />
  );
}
