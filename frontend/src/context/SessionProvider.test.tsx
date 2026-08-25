import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SessionProvider, useSession } from "./SessionProvider";
import { apiFetch } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

function TestComponent() {
  const { user } = useSession();

  const handleFetch = async () => {
    try {
      await apiFetch("/api/data");
    } catch {
      // handled by apiFetch
    }
  };

  return (
    <div>
      <span data-testid="user">{user ? user.id : "null"}</span>
      <button onClick={handleFetch}>Fetch</button>
    </div>
  );
}

describe("SessionProvider 401 handling", () => {
  const mockPush = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue("/app/savings");
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("redirects to login with return path on 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 401,
      ok: false,
    } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Fetch"));
    });

    expect(mockPush).toHaveBeenCalledWith(
      "/login?session_expired=1&returnTo=%2Fapp%2Fsavings",
    );
  });

  it("clears the user session on 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 401,
      ok: false,
    } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Fetch"));
    });

    expect(screen.getByTestId("user")).toHaveTextContent("null");
  });

  it("does not redirect if already on login page", async () => {
    (usePathname as jest.Mock).mockReturnValue("/login");
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 401,
      ok: false,
    } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Fetch"));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not redirect on non-401 responses", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      ok: true,
    } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Fetch"));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
