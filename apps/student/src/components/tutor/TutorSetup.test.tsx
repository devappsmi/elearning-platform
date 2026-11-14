import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TutorSetup } from "./TutorSetup";
import type { TutorCatalog, TutorSetupProps } from "./TutorSetup";

const CATALOG: TutorCatalog = {
  scenarios: [
    { id: "perkenalan", title: "Perkenalan Diri", description: "Berkenalan dengan teman sekelas baru." },
    { id: "restoran", title: "Di Restoran", description: "Memesan makanan." },
    { id: "situasi-baru", title: "Situasi Baru", description: "Belum punya ikon." },
  ],
  characters: [
    { id: "yuki", name: "Yuki", personality: "Ramah dan sabar." },
    { id: "kenji", name: "Kenji", personality: "Santai dan ceria." },
  ],
};
const QUOTA = { limit: 20, used: 4, remaining: 16, resetsAt: "2026-10-04T00:00:00.000Z" };

function renderSetup(overrides: Partial<TutorSetupProps> = {}) {
  const props: TutorSetupProps = {
    catalog: CATALOG,
    quota: QUOTA,
    scenarioId: "perkenalan",
    characterId: "yuki",
    onScenarioChange: vi.fn(),
    onCharacterChange: vi.fn(),
    onStart: vi.fn(),
    voiceNotice: null,
    ...overrides,
  };
  render(<TutorSetup {...props} />);
  return props;
}

describe("TutorSetup", () => {
  it("menampilkan semua situasi dan teman bicara sebagai pilihan radio; yang terpilih ikut props", () => {
    renderSetup({ scenarioId: "restoran", characterId: "kenji" });

    const scenarios = screen.getAllByRole("radio", { name: /Perkenalan Diri|Di Restoran|Situasi Baru/ }) as HTMLInputElement[];
    expect(scenarios.map((r) => [r.value, r.checked])).toEqual([
      ["perkenalan", false],
      ["restoran", true],
      ["situasi-baru", false],
    ]);
    const characters = screen.getAllByRole("radio", { name: /Yuki|Kenji/ }) as HTMLInputElement[];
    expect(characters.map((r) => [r.value, r.checked])).toEqual([
      ["yuki", false],
      ["kenji", true],
    ]);
  });

  it("deskripsi situasi dan kepribadian karakter ikut tampil", () => {
    renderSetup();

    expect(screen.getByText("Berkenalan dengan teman sekelas baru.")).toBeTruthy();
    expect(screen.getByText("Santai dan ceria.")).toBeTruthy();
  });

  it("memilih situasi dan karakter memanggil penangan dengan id-nya", () => {
    const props = renderSetup();

    fireEvent.click(screen.getByRole("radio", { name: /Di Restoran/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Kenji/ }));

    expect(props.onScenarioChange).toHaveBeenCalledWith("restoran");
    expect(props.onCharacterChange).toHaveBeenCalledWith("kenji");
  });

  it("menampilkan sisa jatah dan tombol mulai aktif", () => {
    const props = renderSetup();

    expect(screen.getByTestId("quota-chip").textContent).toBe("Sisa jatah hari ini: 16 dari 20 balasan");
    const start = screen.getByTestId("start-chat") as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    expect(props.onStart).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Jatah ngobrol hari ini sudah habis/)).toBeNull();
  });

  it("jatah habis: tombol mulai mati dan ada penjelasan", () => {
    const props = renderSetup({ quota: { ...QUOTA, used: 20, remaining: 0 } });

    expect((screen.getByTestId("start-chat") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Jatah ngobrol hari ini sudah habis. Jatahmu kembali besok.")).toBeTruthy();
    expect(screen.getByTestId("quota-chip").textContent).toContain("0 dari 20");
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it("catatan tentang rekam suara hanya muncul bila diberikan", () => {
    renderSetup({ voiceNotice: "Rekam suara hanya berfungsi lewat alamat HTTPS. Kamu bisa mengetik jawabanmu." });

    expect(screen.getByText("Rekam suara hanya berfungsi lewat alamat HTTPS. Kamu bisa mengetik jawabanmu.")).toBeTruthy();
  });

  it("tanpa catatan: tidak ada kotak info", () => {
    renderSetup({ voiceNotice: null });

    expect(screen.queryByText(/HTTPS/)).toBeNull();
  });
});
