import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AccessProvider } from "../context/AccessContext";
import { createSeedAccessState } from "../data/accessControl";
import { AuthorizationCenter } from "./AuthorizationCenter";

function renderCenter() {
  return render(<AccessProvider><AuthorizationCenter /></AccessProvider>);
}

describe("AuthorizationCenter navigation and master-data integration", () => {
  it("retains workflow tabs and removes the legacy database tabs", () => {
    renderCenter();
    const navigation = screen.getByRole("navigation", { name: "Governance workspace" });
    const tabLabels = Array.from(navigation.querySelectorAll("button")).map((button) => button.textContent?.trim());

    expect(tabLabels).toEqual(expect.arrayContaining(["Users & roles", "Department inputs", "Audit log"]));
    expect(tabLabels.some((label) => label?.startsWith("Review queue"))).toBe(true);
    expect(tabLabels.some((label) => label?.includes("Supplier database"))).toBe(false);
    expect(tabLabels.some((label) => label?.includes("Customers database"))).toBe(false);
  });

  it("uses active shared master customers in Customer Complaint input", async () => {
    const user = userEvent.setup();
    const activeCustomer = createSeedAccessState().masterData.customers.find((customer) => customer.status === "Active")!;
    renderCenter();

    await user.click(screen.getByRole("button", { name: "Department inputs" }));
    await user.click(screen.getByRole("button", { name: /Customer complaint/ }));

    expect(screen.getByRole("option", { name: activeCustomer.name })).toBeTruthy();
  });

  it("cascades focused paint categories and clears them when Process changes", async () => {
    const user = userEvent.setup();
    renderCenter();
    await user.click(screen.getByRole("button", { name: "Department inputs" }));
    await user.click(screen.getByRole("button", { name: /In-process inspection/ }));

    const process = screen.getByRole("combobox", { name: "Process" });
    const level1 = screen.getByRole("combobox", { name: "Reject category Level 1" });
    const level2 = screen.getByRole("combobox", { name: "Reject category Level 2" });

    await user.selectOptions(process, "Pretreatment");
    expect(Array.from(level1.querySelectorAll("option")).map((option) => option.textContent)).toEqual([
      "Select...", "Cleaning & Chemical Treatment", "Surface Condition & Corrosion"
    ]);
    expect((level2 as HTMLSelectElement).disabled).toBe(true);

    await user.selectOptions(level1, "Cleaning & Chemical Treatment");
    expect((level2 as HTMLSelectElement).disabled).toBe(false);
    expect(Array.from(level2.querySelectorAll("option")).map((option) => option.textContent)).toEqual([
      "Select...", "Poor cleaning", "Contamination", "Incomplete conversion coating"
    ]);
    await user.selectOptions(level2, "Poor cleaning");
    expect((level2 as HTMLSelectElement).value).toBe("Poor cleaning");

    await user.selectOptions(process, "Laser Cutting");
    expect((level1 as HTMLSelectElement).value).toBe("");
    expect((level2 as HTMLSelectElement).value).toBe("");
    expect((level2 as HTMLSelectElement).disabled).toBe(false);
  });
});
