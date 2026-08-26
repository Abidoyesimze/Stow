/**
 * @jest-environment jsdom
 */
import { render } from "@testing-library/react";
import PageViewPing from "./PageViewPing";
import { trackPageView } from "@/lib/analytics";

jest.mock("next/navigation", () => ({
  usePathname: () => "/waitlist",
}));

jest.mock("@/lib/analytics", () => ({
  trackPageView: jest.fn(),
}));

describe("PageViewPing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing", () => {
    const { container } = render(<PageViewPing />);
    expect(container).toBeEmptyDOMElement();
  });

  it("pings trackPageView with the current path on mount", () => {
    render(<PageViewPing />);

    expect(trackPageView).toHaveBeenCalledWith("/waitlist");
  });
});
