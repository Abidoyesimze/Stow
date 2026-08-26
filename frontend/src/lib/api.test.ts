import { apiFetch, ApiError, setSessionExpiredHandler } from "./api";

describe("apiFetch", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    setSessionExpiredHandler(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("passes through non-401 responses unchanged", async () => {
    const mockResponse = { status: 200, ok: true } as Response;
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const response = await apiFetch("/api/data");
    expect(response).toBe(mockResponse);
  });

  it("throws ApiError on 401 response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 401,
      ok: false,
    } as Response);

    await expect(apiFetch("/api/data")).rejects.toThrow(ApiError);
    await expect(apiFetch("/api/data")).rejects.toThrow("Session expired");
  });

  it("calls the registered handler on 401", async () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);

    (global.fetch as jest.Mock).mockResolvedValue({
      status: 401,
      ok: false,
    } as Response);

    await expect(apiFetch("/api/data")).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call the handler for non-401 errors", async () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);

    (global.fetch as jest.Mock).mockResolvedValue({
      status: 500,
      ok: false,
    } as Response);

    await apiFetch("/api/data");
    expect(handler).not.toHaveBeenCalled();
  });

  it("sends credentials by default", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      ok: true,
    } as Response);

    await apiFetch("/api/data");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/data",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("passes through custom init options", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      ok: true,
    } as Response);

    await apiFetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/data",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("prepends API_BASE to path when NEXT_PUBLIC_API_URL is set", async () => {
    const original = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "https://api.stow.app";

    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      ok: true,
    } as Response);

    await apiFetch("/api/data");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.stow.app/api/data",
      expect.anything(),
    );

    process.env.NEXT_PUBLIC_API_URL = original;
  });
});
