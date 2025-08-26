export function getApiMessage(err: unknown): string {
  if (err instanceof Error && typeof err.message === "string") return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Request failed";
}
