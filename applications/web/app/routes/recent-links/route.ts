import { data } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getRecentLinks } from "../../bootstrap.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const codes = [...new Set(new URL(request.url).searchParams.getAll("code"))]
    .filter((code) => code.trim().length > 0)
    .slice(0, 50);
  const result = await getRecentLinks.execute(codes);
  return result.ok
    ? data(
        { links: result.value, error: undefined },
        { headers: { "Cache-Control": "no-store" } },
      )
    : data(
        { links: [], error: "Recent links are temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
}
