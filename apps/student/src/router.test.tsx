import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TUTOR_PATH } from "./lib/tutor-chat";
import { router } from "./router";

function pathsOf(routes: readonly RouteObject[]): string[] {
  return routes.flatMap((route) => [...(route.path ? [route.path] : []), ...pathsOf(route.children ?? [])]);
}

describe("router", () => {
  it("renders without crashing (redirects unauthenticated user to /login)", async () => {
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: "Masuk" })).toBeTruthy();
  });

  it("memuat rute Ngobrol dengan AI, terpisah dari rute skenario /conversation/:id", () => {
    const paths = pathsOf(router.routes);

    expect(paths).toContain(TUTOR_PATH);
    expect(paths).toContain("/conversation/:id");
    expect(paths).toContain("/conversation");
  });

  it("layar Ngobrol dengan AI butuh login: murid yang belum masuk diarahkan ke halaman masuk", async () => {
    window.localStorage.clear();
    render(<RouterProvider router={createMemoryRouter(router.routes, { initialEntries: [TUTOR_PATH] })} />);

    expect(await screen.findByRole("heading", { name: "Masuk" })).toBeTruthy();
  });
});
