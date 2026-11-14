import { redirect } from "react-router";
import type { Route } from "./+types/route";
import {
  resolveShortenedURL,
  redirectShortenedURL,
} from "../../bootstrap.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const useCase =
    request.method === "GET" ? redirectShortenedURL : resolveShortenedURL;
  const result = await useCase.execute(params.code);

  if (!result.ok) {
    throw new Response(result.error.message, {
      status:
        result.error.code === "storage_unavailable"
          ? 503
          : result.error.code === "not_found"
            ? 404
            : 400,
    });
  }

  return redirect(result.value);
}
