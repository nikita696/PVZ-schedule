export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

export const okResult = <T>(data: T, message?: string): ActionResult<T> => ({
  ok: true,
  data,
  message,
});

export const errorResult = <T = never>(error: string): ActionResult<T> => ({
  ok: false,
  error,
});
