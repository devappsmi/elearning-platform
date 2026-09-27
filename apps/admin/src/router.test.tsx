import { render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { router } from "./router";

describe("router", () => {
  it("renders without crashing (redirects unauthenticated user to /login)", async () => {
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("Login")).toBeTruthy();
  });
});
