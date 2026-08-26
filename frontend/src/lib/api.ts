export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type SessionExpiredHandler = () => void;

let _onSessionExpired: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(
  handler: SessionExpiredHandler | null,
): void {
  _onSessionExpired = handler;
}

export async function apiFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const url = apiBase ? `${apiBase}${input}` : input;

  const response = await fetch(url, {
    credentials: "include",
    ...init,
  });

  if (response.status === 401) {
    _onSessionExpired?.();
    throw new ApiError("Session expired", 401);
  }

  return response;
}
