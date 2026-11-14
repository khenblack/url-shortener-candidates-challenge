import type { ClickRecorder } from "../ports/shortener-repository";
import type { ResolveShortenedURLUseCase } from "./resolve-shortened-url";

export class RedirectShortenedURLUseCase {
  constructor(
    private readonly resolve: ResolveShortenedURLUseCase,
    private readonly recorder: ClickRecorder,
  ) {}

  async execute(input: unknown) {
    const result = await this.resolve.execute(input);
    if (!result.ok) return result;
    try {
      await this.recorder.incrementClicks(input as string);
    } catch {
      console.log("Failed to record click");
    }
    return result;
  }
}
