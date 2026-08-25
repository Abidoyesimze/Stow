import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddressBadge from "./AddressBadge";

const ADDRESS = "GABCD1234567890EFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ";

jest.mock("qrcode", () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,fakeQrData"),
  },
}));

describe("AddressBadge", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders a truncated version of the address", () => {
    render(<AddressBadge address={ADDRESS} />);
    expect(screen.getByTitle(ADDRESS)).toHaveTextContent("GABC\u2026WXYZ");
  });

  it("copies the full address to the clipboard when the copy button is clicked", async () => {
    render(<AddressBadge address={ADDRESS} />);
    fireEvent.click(screen.getByRole("button", { name: /copy address/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ADDRESS);
    });
  });

  it("falls back and shows an error message if copying fails", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) },
    });
    // Force the execCommand fallback to also fail so we hit the error path.
    document.execCommand = jest.fn().mockReturnValue(false);

    render(<AddressBadge address={ADDRESS} />);
    fireEvent.click(screen.getByRole("button", { name: /copy address/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t copy/i);
  });

  it("renders a QR code when the QR button is clicked", async () => {
    render(<AddressBadge address={ADDRESS} />);
    fireEvent.click(screen.getByRole("button", { name: /show qr code/i }));

    const qrImage = await screen.findByAltText(`QR code for ${ADDRESS}`);
    expect(qrImage).toBeInTheDocument();
    expect(qrImage).toHaveAttribute("src", expect.stringContaining("data:image/png"));
  });

  it("closes the QR dialog when the close button is clicked", async () => {
    render(<AddressBadge address={ADDRESS} />);
    fireEvent.click(screen.getByRole("button", { name: /show qr code/i }));
    await screen.findByAltText(`QR code for ${ADDRESS}`);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});