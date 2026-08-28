import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultFilters, sampleDataset } from "../data/qualityData";
import { FilterPanel } from "./FilterPanel";

describe("FilterPanel", () => {
  it("limits process choices to the active operation", () => {
    render(<FilterPanel rows={sampleDataset.inspections} operation="sheet-metal" filters={defaultFilters} onChange={() => undefined} />);
    const process = screen.getByLabelText("Process") as HTMLSelectElement;
    expect(Array.from(process.options).some((option) => option.text === "Laser Cutting")).toBe(true);
    expect(Array.from(process.options).some((option) => option.text === "CNC Milling")).toBe(false);
  });

  it("cascades process to related work centers and resets invalid selections", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const relationRows = [
      { ...sampleDataset.inspections[0], id: "REL-1", operation: "sheet-metal" as const, stage: "in-process" as const, process: "Welding", workCenter: "Weld Bay" },
      { ...sampleDataset.inspections[1], id: "REL-2", operation: "sheet-metal" as const, stage: "in-process" as const, process: "Laser Cutting", workCenter: "Fabrication Cell A" },
      { ...sampleDataset.inspections[2], id: "REL-3", operation: "sheet-metal" as const, stage: "outgoing" as const, process: "Laser Cutting", workCenter: "Fabrication Cell A" }
    ];
    const filters = { ...defaultFilters, stage: "in-process" as const, process: "Welding", workCenter: "Weld Bay" };
    const view = render(<FilterPanel rows={relationRows} operation="sheet-metal" filters={filters} onChange={onChange} />);
    expect(Array.from((screen.getByLabelText("Work center") as HTMLSelectElement).options).map((option) => option.text)).toEqual(["All work centers", "Weld Bay"]);

    await user.selectOptions(screen.getByLabelText("Process"), "Laser Cutting");
    expect(onChange).toHaveBeenCalledWith({ ...filters, process: "Laser Cutting", workCenter: "all" });
    view.rerender(<FilterPanel rows={relationRows} operation="sheet-metal" filters={{ ...filters, process: "Laser Cutting", workCenter: "all" }} onChange={onChange} />);
    expect(Array.from((screen.getByLabelText("Work center") as HTMLSelectElement).options).map((option) => option.text)).toEqual(["All work centers", "Fabrication Cell A"]);

    view.rerender(<FilterPanel rows={relationRows} operation="sheet-metal" filters={filters} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText("Stage"), "outgoing");
    expect(onChange).toHaveBeenCalledWith({ ...filters, stage: "outgoing", process: "all", workCenter: "all", supplier: "all" });
    view.rerender(<FilterPanel rows={relationRows} operation="sheet-metal" filters={{ ...filters, stage: "outgoing", process: "all", workCenter: "all", supplier: "all" }} onChange={onChange} />);
    expect(Array.from((screen.getByLabelText("Process") as HTMLSelectElement).options).map((option) => option.text)).toEqual(["All processes", "Laser Cutting"]);
  });

  it("emits a removable filter and resets to defaults", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filters = { ...defaultFilters, supplier: "Apex Metals" };
    render(<FilterPanel rows={sampleDataset.inspections} operation="all" filters={filters} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /Supplier: Apex Metals/i }));
    expect(onChange).toHaveBeenCalledWith(defaultFilters);
  });

  it("disables process and work center for incoming inspection and clears them", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterPanel rows={sampleDataset.inspections} operation="all" filters={{ ...defaultFilters, process: "Laser Cutting", workCenter: "Fabrication Cell A" }} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText("Stage"), "incoming");
    expect(onChange).toHaveBeenCalledWith({ ...defaultFilters, process: "all", workCenter: "all", stage: "incoming" });
  });

  it("disables supplier for process and outgoing inspection and clears it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filters = { ...defaultFilters, supplier: "Apex Metals" };
    const view = render(<FilterPanel rows={sampleDataset.inspections} complaints={sampleDataset.complaints} operation="all" filters={filters} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText("Stage"), "in-process");
    view.rerender(<FilterPanel rows={sampleDataset.inspections} operation="all" filters={{ ...filters, stage: "in-process", supplier: "all" }} onChange={onChange} />);
    expect((screen.getByLabelText("Supplier") as HTMLSelectElement).disabled).toBe(true);
    expect(onChange).toHaveBeenCalledWith({ ...filters, stage: "in-process", supplier: "all" });
  });

  it("offers Customer Complaint as a stage and clears inspection-only filters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filters = { ...defaultFilters, process: "Welding", workCenter: "Weld Bay", supplier: "Apex Metals" };
    const view = render(<FilterPanel rows={sampleDataset.inspections} operation="all" filters={filters} onChange={onChange} />);
    expect(Array.from((screen.getByLabelText("Stage") as HTMLSelectElement).options).map((option) => option.text)).toContain("Customer Complaint");
    await user.selectOptions(screen.getByLabelText("Stage"), "customer-complaint");
    expect(onChange).toHaveBeenCalledWith({ ...filters, stage: "customer-complaint", process: "all", workCenter: "all", supplier: "all" });
    view.rerender(<FilterPanel rows={sampleDataset.inspections} complaints={sampleDataset.complaints} operation="all" filters={{ ...filters, stage: "customer-complaint", process: "all", workCenter: "all", supplier: "all" }} onChange={onChange} />);
    expect((screen.getByLabelText("Process") as HTMLSelectElement).disabled).toBe(false);
    expect(Array.from((screen.getByLabelText("Process") as HTMLSelectElement).options).map((option) => option.text)).toContain(sampleDataset.complaints[0].process);
    expect((screen.getByLabelText("Work center") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Supplier") as HTMLSelectElement).disabled).toBe(true);
  });

  it("offers calendar year and quarter period filters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterPanel rows={sampleDataset.inspections} operation="all" filters={defaultFilters} onChange={onChange} />);
    const period = screen.getByLabelText("Period") as HTMLSelectElement;
    expect(Array.from(period.options).map((option) => option.text)).toContain("2026 year");
    expect(Array.from(period.options).map((option) => option.text)).toContain("Q3 2026");
    await user.selectOptions(period, "q2");
    expect(onChange).toHaveBeenCalledWith({ ...defaultFilters, preset: "q2" });
  });

  it("applies a valid year range and blocks a reversed range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterPanel rows={sampleDataset.inspections} complaints={sampleDataset.complaints} operation="all" filters={defaultFilters} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText("Period mode"), "year-range");
    await user.selectOptions(screen.getByLabelText("From year"), "2026");
    await user.selectOptions(screen.getByLabelText("To year"), "2026");
    await user.click(screen.getByRole("button", { name: /Apply/i }));
    expect(onChange).toHaveBeenCalledWith({ ...defaultFilters, periodMode: "year-range", yearFrom: 2026, yearTo: 2026 });

    await user.selectOptions(screen.getByLabelText("From year"), "2026");
    await user.selectOptions(screen.getByLabelText("To year"), "2025");
    expect((screen.getByRole("button", { name: /Apply/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("End period must be on or after start period");
  });

  it("offers a day range and blocks reversed dates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterPanel rows={sampleDataset.inspections} complaints={sampleDataset.complaints} operation="all" filters={defaultFilters} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText("Period mode"), "day-range");
    await user.clear(screen.getByLabelText("From date"));
    await user.type(screen.getByLabelText("From date"), "2026-08-19");
    await user.clear(screen.getByLabelText("To date"));
    await user.type(screen.getByLabelText("To date"), "2026-08-20");
    await user.click(screen.getByRole("button", { name: /Apply/i }));
    expect(onChange).toHaveBeenCalledWith({ ...defaultFilters, periodMode: "day-range", dayFrom: "2026-08-19", dayTo: "2026-08-20" });

    await user.clear(screen.getByLabelText("From date"));
    await user.type(screen.getByLabelText("From date"), "2026-08-21");
    await user.clear(screen.getByLabelText("To date"));
    await user.type(screen.getByLabelText("To date"), "2026-08-20");
    expect((screen.getByRole("button", { name: /Apply/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("End period must be on or after start period");
  });

  it("orders period modes from day through year and supports month range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterPanel rows={sampleDataset.inspections} complaints={sampleDataset.complaints} operation="all" filters={defaultFilters} onChange={onChange} />);
    const periodMode = screen.getByLabelText("Period mode") as HTMLSelectElement;
    expect(Array.from(periodMode.options).map((option) => option.text)).toEqual(["Day range", "Week range", "Month range", "Quarter range", "Year range", "Quick preset"]);
    await user.selectOptions(periodMode, "month-range");
    await user.clear(screen.getByLabelText("From month"));
    await user.type(screen.getByLabelText("From month"), "2026-04");
    await user.clear(screen.getByLabelText("To month"));
    await user.type(screen.getByLabelText("To month"), "2026-06");
    await user.click(screen.getByRole("button", { name: /Apply/i }));
    expect(onChange).toHaveBeenCalledWith({ ...defaultFilters, periodMode: "month-range", monthFrom: "2026-04", monthTo: "2026-06" });
  });
});
