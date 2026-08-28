import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultFilters, sampleDataset, type DashboardFilters } from "../data/qualityData";
import { ExecutiveOverview, reorderVisibleItems } from "./ExecutiveOverview";

function renderOverview(stage: DashboardFilters["stage"]) {
  return render(
    <ExecutiveOverview
      dataset={sampleDataset}
      operation="all"
      filters={{ ...defaultFilters, stage }}
      onFiltersChange={() => undefined}
      onOpenExplorer={() => undefined}
    />
  );
}

describe("ExecutiveOverview stage correlation", () => {
  it("keeps lifecycle KPI cards without the detailed contribution monitor", () => {
    render(<ExecutiveOverview dataset={sampleDataset} operation="all" filters={defaultFilters} onFiltersChange={() => undefined} onOpenExplorer={() => undefined} />);
    expect(screen.getByText("NPI parts")).toBeTruthy();
    expect(screen.getByText("Production parts")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Part contribution monitoring" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Quality performance trend" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Part type" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "NPI vs Production" })).toBeTruthy();
    const trendSelect = screen.getByRole("combobox", { name: "Trend metric" }) as HTMLSelectElement;
    expect(trendSelect.value).toBe("partType");
    expect(Array.from(trendSelect.options, (option) => option.value)).toEqual(["partType", "acceptance", "qppm"]);
  });

  it("keeps Stage exposure in the aggregate view", () => {
    renderOverview("all");
    expect(screen.getByRole("heading", { name: "Stage exposure" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Quality performance trend" })).toBeTruthy();
  });

  it("keeps trend reset active and restores the default metric and period", () => {
    const onFiltersChange = vi.fn();
    render(<ExecutiveOverview dataset={sampleDataset} operation="all" filters={{ ...defaultFilters, periodMode: "month-range", monthFrom: "2026-05", monthTo: "2026-08" }} onFiltersChange={onFiltersChange} onOpenExplorer={() => undefined} />);
    const trendSelect = screen.getByRole("combobox", { name: "Trend metric" }) as HTMLSelectElement;
    fireEvent.change(trendSelect, { target: { value: "acceptance" } });
    const trendCard = screen.getByRole("heading", { name: "Quality performance trend" }).closest(".chart-card")!;
    const resetButton = trendCard.querySelector<HTMLButtonElement>("button.text-button")!;
    expect(resetButton.disabled).toBe(false);
    fireEvent.click(resetButton);
    expect(trendSelect.value).toBe("partType");
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ periodMode: "preset", preset: "12m" }));
  });

  it("shows incoming analysis without process and work-center comparisons", () => {
    renderOverview("incoming");
    expect(screen.getByRole("heading", { name: "Supplier quality" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reject category Level 1" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reject category Level 2" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Top problem parts" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Process quality" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Work-center comparison" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Stage exposure" })).toBeNull();
  });

  it.each(["in-process", "outgoing"] as const)("shows process analysis for %s", (stage) => {
    localStorage.removeItem("manufacturing-quality-analysis-layout-v1");
    const { container } = renderOverview(stage);
    expect(screen.getByRole("heading", { name: "Process quality" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Internal cost of quality" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Work-center comparison" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reject category Level 1" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reject category Level 2" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Top problem parts" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Supplier quality" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Stage exposure" })).toBeNull();
    const headings = Array.from(container.querySelectorAll(".analysis-drag-item h3"), (heading) => heading.textContent);
    expect(headings.indexOf("Internal cost of quality") + 1).toBe(headings.indexOf("Top problem parts"));
  });

  it.each(["all", "incoming", "customer-complaint"] as const)("hides internal cost analysis for %s", (stage) => {
    renderOverview(stage);
    expect(screen.queryByRole("heading", { name: "Internal cost of quality" })).toBeNull();
  });

  it("inserts internal cost before parts in a legacy saved analysis layout", () => {
    localStorage.setItem("manufacturing-quality-analysis-layout-v1", JSON.stringify(["complaints", "suppliers", "cost", "defects", "parts", "workCenters"]));
    const { container } = renderOverview("in-process");
    expect(Array.from(container.querySelectorAll(".analysis-drag-item h3"), (heading) => heading.textContent)).toEqual([
      "Reject category Level 1",
      "Process quality",
      "Reject category Level 2",
      "Internal cost of quality",
      "Top problem parts",
      "Work-center comparison"
    ]);
  });

  it("includes the customer complaint stage with complaint-specific analysis", () => {
    const { container } = renderOverview("customer-complaint");
    expect(screen.getByRole("heading", { name: "Customer exposure" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Defect category Level 2" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Defect category Level 1" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "External failure cost" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Top complaint parts" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Process affected" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Stage exposure" })).toBeNull();
    expect(Array.from(container.querySelectorAll(".analysis-drag-item h3"), (heading) => heading.textContent)).toEqual([
      "External failure cost",
      "Defect category Level 2",
      "Top complaint parts",
      "Defect category Level 1",
      "Process affected",
      "Customer exposure"
    ]);
    const level2Card = screen.getByRole("heading", { name: "Defect category Level 2" }).closest(".chart-card");
    expect(level2Card?.classList.contains("chart-card--wide")).toBe(true);
    expect(level2Card?.classList.contains("chart-card--resizable")).toBe(true);
  });

  it("keeps complaint category selections in Executive Overview", () => {
    const onFiltersChange = vi.fn();
    const onOpenExplorer = vi.fn();
    const { container } = render(<ExecutiveOverview dataset={sampleDataset} operation="all" filters={{ ...defaultFilters, stage: "customer-complaint" }} onFiltersChange={onFiltersChange} onOpenExplorer={onOpenExplorer} />);
    const level2Reason = screen.getAllByRole("rowheader")[0];
    const expectedLevel2 = level2Reason.textContent?.replace(/[\d,]+$/, "") ?? "";
    fireEvent.click(level2Reason);
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ rejectCategoryLevel2: expectedLevel2 }));
    expect(onOpenExplorer).not.toHaveBeenCalled();

    expect(onOpenExplorer).not.toHaveBeenCalled();
    expect(container.querySelector(".analysis-drag-item--wide .chart-card--resizable")).toBeTruthy();
  });

  it("filters the complete overview when a problem part is selected", () => {
    const onFiltersChange = vi.fn();
    const onOpenExplorer = vi.fn();
    render(<ExecutiveOverview dataset={sampleDataset} operation="all" filters={defaultFilters} onFiltersChange={onFiltersChange} onOpenExplorer={onOpenExplorer} />);
    const part = sampleDataset.inspections[0].partNumber;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(part) }));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ partNumber: part }));
    expect(onOpenExplorer).not.toHaveBeenCalled();
  });

  it("keeps complaint part selections in the complaint overview", () => {
    const onFiltersChange = vi.fn();
    const onOpenExplorer = vi.fn();
    render(<ExecutiveOverview dataset={sampleDataset} operation="all" filters={{ ...defaultFilters, stage: "customer-complaint" }} onFiltersChange={onFiltersChange} onOpenExplorer={onOpenExplorer} />);
    const part = sampleDataset.complaints[0].partNumber;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(part) }));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ partNumber: part }));
    expect(onOpenExplorer).not.toHaveBeenCalled();
  });

  it("uses the selected customer's delivered quantity for complaint KPIs", () => {
    const complaint = { ...sampleDataset.complaints[0], customer: "Customer A", complaintDate: "2026-08-18" };
    const dataset = {
      ...sampleDataset,
      complaints: [complaint],
      deliveries: [
        { id: "DEL-A", month: "2026-08", operation: complaint.operation, customer: "Customer A", deliveredQty: 1000 },
        { id: "DEL-B", month: "2026-08", operation: complaint.operation, customer: "Customer B", deliveredQty: 2000 }
      ]
    };
    render(<ExecutiveOverview dataset={dataset} operation="all" filters={{ ...defaultFilters, stage: "customer-complaint", customer: "Customer A" }} onFiltersChange={() => undefined} onOpenExplorer={() => undefined} />);
    expect(screen.getByText("Delivered: 1,000")).toBeTruthy();
  });

  it("persists complaint panel moves without changing the standard analysis layout", () => {
    const standardLayout = ["complaints", "suppliers", "cost", "defects", "parts", "workCenters"];
    localStorage.setItem("manufacturing-quality-analysis-layout-v1", JSON.stringify(standardLayout));
    localStorage.removeItem("manufacturing-quality-complaint-analysis-layout-v1");
    renderOverview("customer-complaint");
    const transfer = { effectAllowed: "none", setData: vi.fn() };
    fireEvent.dragStart(screen.getByLabelText("Reorder cost analysis"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByLabelText("Reorder defects analysis"), { dataTransfer: transfer, clientY: 1 });
    expect(JSON.parse(localStorage.getItem("manufacturing-quality-complaint-analysis-layout-v1") ?? "[]")).toEqual(["defects", "cost", "parts", "suppliers", "workCenters", "complaints"]);
    expect(JSON.parse(localStorage.getItem("manufacturing-quality-analysis-layout-v1") ?? "[]")).toEqual(standardLayout);
    expect(screen.queryByRole("button", { name: "Reset layout" })).toBeNull();
  });
});

describe("ExecutiveOverview section locations", () => {
  it("moves within the visible stage order without shifting hidden sections", () => {
    const fullOrder = ["complaints", "cost", "defects", "parts", "suppliers", "workCenters"] as const;
    const incomingOrder = ["cost", "defects", "parts", "suppliers"] as const;

    expect(reorderVisibleItems([...fullOrder], [...incomingOrder], "suppliers", "cost", "before"))
      .toEqual(["complaints", "suppliers", "cost", "defects", "parts", "workCenters"]);
    expect(reorderVisibleItems([...fullOrder], [...incomingOrder], "cost", "suppliers", "after"))
      .toEqual(["complaints", "defects", "parts", "suppliers", "cost", "workCenters"]);
  });

  it("does not reorder when the destination is hidden", () => {
    const fullOrder = ["complaints", "cost", "defects", "parts", "suppliers", "workCenters"] as const;
    const incomingOrder = ["cost", "defects", "parts", "suppliers"] as const;
    expect(reorderVisibleItems([...fullOrder], [...incomingOrder], "cost", "workCenters", "before")).toEqual([...fullOrder]);
  });
});
