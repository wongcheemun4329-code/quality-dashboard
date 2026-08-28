import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccessProvider } from "../context/AccessContext";
import { STORAGE_KEY, sampleDataset } from "../data/qualityData";
import { DataManager } from "./DataManager";

function renderDataManager(props: React.ComponentProps<typeof DataManager>) {
  return render(<AccessProvider><DataManager {...props} /></AccessProvider>);
}

describe("DataManager", () => {
  it("restores the deterministic sample dataset and clears persisted data", async () => {
    const user = userEvent.setup();
    const onDatasetChange = vi.fn();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ inspections: [] }));
    renderDataManager({ dataset: { ...sampleDataset, inspections: sampleDataset.inspections.slice(0, 2) }, onDatasetChange });
    await user.click(screen.getByRole("button", { name: /Restore/i }));
    expect(onDatasetChange).toHaveBeenCalledWith(sampleDataset);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("keeps Apply disabled before a workbook passes validation", () => {
    renderDataManager({ dataset: sampleDataset, onDatasetChange: () => undefined });
    expect((screen.getByRole("button", { name: /Apply valid import/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers header downloads in XLSX, XLS, and CSV formats", () => {
    renderDataManager({ dataset: sampleDataset, onDatasetChange: () => undefined });
    expect(screen.getByLabelText("Header format")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Download headers/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: "XLSX" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "XLS" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "CSV" })).toBeTruthy();
    expect(screen.getByLabelText("Template type")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Manual + reference data" })).toBeTruthy();
  });
});
