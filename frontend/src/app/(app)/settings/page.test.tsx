import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "./page";
import * as api from "@/lib/api";

jest.mock("@/lib/api");

const mockApiFetch = api.apiFetch as jest.MockedFunction<typeof api.apiFetch>;

const mockPreferences = {
  savingsReminders: true,
  goalProgress: true,
  withdrawalAlerts: true,
  systemUpdates: false,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads preferences on mount", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/user/preferences/notifications",
    );
  });

  it("displays error state when loading fails", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: async () => ({ message: "Failed to load" }),
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });
  });

  it("toggles notification preference with optimistic update", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockPreferences, savingsReminders: false }),
      } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Toggle Savings Reminders/i),
      ).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText(/Toggle Savings Reminders/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/user/preferences/notifications",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ ...mockPreferences, savingsReminders: false }),
        }),
      );
    });
  });

  it("rolls back on save failure", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Save failed" }),
      } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Toggle Savings Reminders/i),
      ).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText(/Toggle Savings Reminders/i);
    const initialChecked = toggle.getAttribute("aria-checked") === "true";

    fireEvent.click(toggle);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
    });

    // Should roll back to previous state
    await waitFor(() => {
      expect(toggle.getAttribute("aria-checked")).toBe(
        initialChecked.toString(),
      );
    });
  });

  it("updates quiet hours time settings", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockPreferences, quietHoursEnabled: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockPreferences,
          quietHoursEnabled: true,
          quietHoursStart: "23:00",
        }),
      } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Start Time/i)).toBeInTheDocument();
    });

    const startTimeInput = screen.getByLabelText(
      /Start Time/i,
    ) as HTMLInputElement;
    fireEvent.change(startTimeInput, { target: { value: "23:00" } });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/user/preferences/notifications",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"quietHoursStart":"23:00"'),
        }),
      );
    });
  });

  it("shows success message after saving", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Toggle Savings Reminders/i),
      ).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText(/Toggle Savings Reminders/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(
        screen.getByText(/Preferences saved successfully/i),
      ).toBeInTheDocument();
    });
  });

  it("enables quiet hours controls when toggle is on", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockPreferences, quietHoursEnabled: true }),
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Start Time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Time/i)).toBeInTheDocument();
    });
  });

  it("hides quiet hours controls when toggle is off", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByLabelText(/Start Time/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/End Time/i)).not.toBeInTheDocument();
    });
  });

  it("renders all notification categories", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Savings Reminders")).toBeInTheDocument();
      expect(screen.getByText("Goal Progress")).toBeInTheDocument();
      expect(screen.getByText("Withdrawal Alerts")).toBeInTheDocument();
      expect(screen.getByText("System Updates")).toBeInTheDocument();
    });
  });
});
