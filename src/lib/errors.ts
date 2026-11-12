export interface ConflictError {
  kind: "conflict";
  message: string;
  currentMtime: number;
}

export function isConflict(error: unknown): error is ConflictError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { kind?: string }).kind === "conflict"
  );
}

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; kind?: unknown };
    if (typeof value.message === "string") return value.message;
  }
  return String(error);
}
