import type { RenderRequest, RenderResult } from "../types";

/** A backend that turns images plus a prompt into a new image. */
export interface Provider {
  readonly id: string;
  readonly label: string;
  render(req: RenderRequest, signal?: AbortSignal): Promise<RenderResult>;
  /** Quick check that the settings work. Resolves with a short status line. */
  test(): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
