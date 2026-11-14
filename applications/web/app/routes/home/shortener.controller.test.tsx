import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, data } from "react-router";
import type { ActionFunction, ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortenerController } from "./shortener.controller";
import { action as shortenAction } from "./route";

import { readRecentCodes, writeRecentCodes } from "./recent-links-storage";
const recentRequests: string[][] = [];
beforeEach(() => {
  localStorage.clear();
  recentRequests.length = 0;
});
afterEach(() => localStorage.clear());

function renderController(action?: ActionFunction, clickCount = () => 2) {
  const Stub = createRoutesStub([
    {
      path: "/recent-links",
      loader: ({ request }) => {
        const codes = new URL(request.url).searchParams.getAll("code");
        recentRequests.push(codes);
        return {
          links: codes.map((code) => ({
            code,
            destination: `https://example.com/${code}`,
            clickCount: clickCount(),
          })),
        };
      },
    },
    {
      path: "/",
      Component: ShortenerController,
      HydrateFallback: () => null,
      loader: () => ({ baseUrl: "https://sho.rt/s/" }),
      action,
    },
  ]);

  return render(<Stub initialEntries={["/"]} />);
}

describe("ShortenerController", () => {
  it("renders returned HTTP 400 action data as inline feedback", async () => {
    const user = userEvent.setup();
    renderController(shortenAction);

    await user.type(await screen.findByRole("textbox"), "ftp://example.com");
    await user.click(screen.getByRole("button", { name: "SHORTEN IT" }));

    expect(
      await screen.findByText("Only http:// and https:// URLs are supported."),
    ).toBeVisible();
    expect(screen.getByRole("textbox")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("displays the loader prefix before any submission", async () => {
    renderController();

    expect(
      await screen.findByText(/Your shortened URL will start with/),
    ).toHaveTextContent("https://sho.rt/s/");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("URL is required")).not.toBeInTheDocument();
  });

  it("submits the URL through the router and displays the action result", async () => {
    const user = userEvent.setup();
    const requests: { method: string; url: FormDataEntryValue | null }[] = [];
    const action = vi.fn(async ({ request }: ActionFunctionArgs) => {
      const data = await request.formData();
      requests.push({ method: request.method, url: data.get("url") });
      return { shortenedUrl: "https://sho.rt/s/ab" };
    });
    renderController(action);

    await user.type(
      await screen.findByRole("textbox"),
      "https://example.com/path",
    );
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("link", { name: "https://sho.rt/s/ab" }),
    ).toHaveAttribute("href", "https://sho.rt/s/ab");
    expect(action).toHaveBeenCalledTimes(1);
    expect(requests).toEqual([
      { method: "POST", url: "https://example.com/path" },
    ]);
  });

  it("replaces a prior result with an error from a subsequent action", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValueOnce({ shortenedUrl: "https://sho.rt/s/ab" })
      .mockResolvedValueOnce({ error: "URL is required" });
    renderController(action);

    await user.type(await screen.findByRole("textbox"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "SHORTEN IT" }));
    await screen.findByRole("link");
    await user.click(screen.getByRole("button", { name: "SHORTEN IT" }));

    expect(await screen.findByText("URL is required")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(2);
  });
  it.each([
    "Could not create a short link. Please try again.",
    "Service temporarily unavailable. Please try again.",
  ])("preserves input and clears prior success on 503: %s", async (error) => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValueOnce({ shortenedUrl: "https://sho.rt/s/old" })
      .mockResolvedValueOnce(data({ error }, { status: 503 }));
    renderController(action);
    const input = await screen.findByRole("textbox");
    await user.type(input, "https://example.com/keep-me");
    await user.click(screen.getByRole("button", { name: "SHORTEN IT" }));
    await screen.findByRole("link");
    await user.click(screen.getByRole("button", { name: "SHORTEN IT" }));
    expect(await screen.findByText(error)).toBeVisible();
    expect(input).toHaveValue("https://example.com/keep-me");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

it("loads only browser selections again after remount", async () => {
  writeRecentCodes(localStorage, ["legacy-!", "old"]);
  const first = renderController();
  expect(await screen.findByText("https://example.com/legacy-!")).toBeVisible();
  expect(screen.getAllByText("2 clicks")).toHaveLength(2);
  expect(recentRequests).toEqual([["legacy-!", "old"]]);
  first.unmount();
  renderController();
  await screen.findByText("https://example.com/old");
  expect(recentRequests).toEqual([
    ["legacy-!", "old"],
    ["legacy-!", "old"],
  ]);
});

it("adds successful creations first and refreshes a duplicate without growing history", async () => {
  writeRecentCodes(localStorage, ["old", "aa"]);
  const user = userEvent.setup();
  renderController(() => ({
    shortenedUrl: "https://sho.rt/s/aa",
    shortCode: "aa",
  }));
  await screen.findByText("https://example.com/old");
  await user.type(screen.getByRole("textbox"), "https://example.com/aa");
  await user.click(screen.getByRole("button", { name: "SHORTEN IT" }));
  await screen.findByText("Your shortened URL:");
  expect(readRecentCodes(localStorage)).toEqual(["aa", "old"]);
  expect(recentRequests.at(-1)).toEqual(["aa", "old"]);
});

it("does not fetch a global listing for an empty browser", async () => {
  renderController();
  await screen.findByRole("heading", { name: "Your Recent Links" });
  fireEvent.focus(window);
  expect(recentRequests).toEqual([]);
});

it("refreshes displayed counts when returning to the app window", async () => {
  writeRecentCodes(localStorage, ["aa"]);
  let clicks = 2;
  const view = renderController(undefined, () => clicks);
  expect(await screen.findByText("2 clicks")).toBeVisible();

  clicks = 3;
  fireEvent.focus(window);

  expect(await screen.findByText("3 clicks")).toBeVisible();
  expect(recentRequests).toEqual([["aa"], ["aa"]]);
  expect(readRecentCodes(localStorage)).toEqual(["aa"]);

  view.unmount();
  fireEvent.focus(window);
  expect(recentRequests).toHaveLength(2);
});
