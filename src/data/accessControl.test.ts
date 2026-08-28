import { describe, expect, it } from "vitest";
import { ACCESS_STORAGE_KEY, activeDefectLevel1ForProcess, activeDefectLevel2ForProcessAndLevel1, canApproveEntry, canCreateModule, canViewEntry, customerDatabase, dataModules, hasPermission, loadAccessState, seedAccessState, supplierDatabase } from "./accessControl";

describe("access control policy", () => {
  it("provides the shared supplier database to supplier-owned input fields", () => {
    const supplierNames = supplierDatabase.filter((supplier) => supplier.status === "Active").map((supplier) => supplier.name);
    expect(supplierNames).toEqual(expect.arrayContaining(["Apex Metals", "Orion Alloys", "Kencana Fasteners", "NexForm Coatings", "Mekong Precision", "Kencana Tooling"]));
    ["incoming-inspection", "material-receipt", "supplier-performance"].forEach((moduleId) => {
      const supplierField = dataModules.find((module) => module.id === moduleId)?.fields.find((field) => field.key === "supplier");
      expect(supplierField?.type).toBe("select");
      expect(supplierField?.options).toEqual(supplierNames);
    });
  });

  it("provides the shared customer database to customer complaint inputs", () => {
    const customerNames = customerDatabase.filter((customer) => customer.status === "Active").map((customer) => customer.name);
    const customerField = dataModules.find((module) => module.id === "customer-complaint")?.fields.find((field) => field.key === "customer");
    expect(customerField?.type).toBe("select");
    expect(customerField?.options).toEqual(customerNames);
  });

  it("gives the platform administrator full governance access", () => {
    const admin = seedAccessState.users[0];
    expect(hasPermission(admin, "users.manage")).toBe(true);
    expect(hasPermission(admin, "raw.approve")).toBe(true);
    expect(hasPermission(admin, "audit.view")).toBe(true);
  });

  it("allows seeded demo data-entry users to use every department module", () => {
    const productionUser = seedAccessState.users.find((user) => user.id === "USR-004")!;
    expect(canCreateModule(productionUser, dataModules.find((module) => module.id === "production-output")!)).toBe(true);
    expect(canCreateModule(productionUser, dataModules.find((module) => module.id === "maintenance-event")!)).toBe(true);
  });

  it("activates every department input module for every seeded demo user", () => {
    seedAccessState.users.forEach((user) => {
      dataModules.forEach((module) => expect(canCreateModule(user, module)).toBe(true));
    });
  });

  it("does not activate draft creation for non-demo users or suspended demo users", () => {
    const nonDemoUser = { ...seedAccessState.users[4], id: "USR-100", demoAccess: false };
    const suspendedDemoUser = { ...seedAccessState.users[3], status: "Suspended" as const };
    expect(canCreateModule(nonDemoUser, dataModules.find((module) => module.id === "production-output")!)).toBe(false);
    expect(canCreateModule(suspendedDemoUser, dataModules.find((module) => module.id === "production-output")!)).toBe(false);
  });

  it("migrates legacy seeded browser state to demo input access", () => {
    const legacyState = { ...seedAccessState, demoMode: undefined, users: seedAccessState.users.map(({ demoAccess: _demoAccess, ...user }) => user) };
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(legacyState));
    const migrated = loadAccessState();
    expect(migrated.demoMode).toBe(true);
    expect(migrated.users.every((user) => user.demoAccess === true)).toBe(true);
    expect(migrated.customers).toEqual(customerDatabase);
  });

  it("prevents the record creator from approving their own submission", () => {
    const qualityManager = seedAccessState.users.find((user) => user.id === "USR-002")!;
    const submittedByQualityManager = { ...seedAccessState.entries[0], createdBy: qualityManager.id, departmentId: "quality" as const, status: "Submitted" as const };
    expect(canApproveEntry(qualityManager, submittedByQualityManager)).toBe(false);
    expect(canApproveEntry(qualityManager, seedAccessState.entries[0])).toBe(true);
  });

  it("keeps ordinary data entry users within their own department scope", () => {
    const productionUser = seedAccessState.users.find((user) => user.id === "USR-004")!;
    expect(canViewEntry(productionUser, seedAccessState.entries[0])).toBe(true);
    expect(canViewEntry(productionUser, seedAccessState.entries[1])).toBe(false);
  });

  it("limits focused paint processes to their two active Level 1 categories", () => {
    const expected: Record<string, string[]> = {
      Pretreatment: ["Cleaning & Chemical Treatment", "Surface Condition & Corrosion"],
      "Powder Coating": ["Appearance & Coverage", "Adhesion, Cure & Colour"],
      Painting: ["Appearance & Coverage", "Adhesion, Cure & Colour"]
    };
    Object.entries(expected).forEach(([process, categories]) => {
      expect(activeDefectLevel1ForProcess(seedAccessState.masterData, process).map((row) => row.name)).toEqual(categories);
    });
  });

  it("keeps universal Level 1 categories for non-paint processes", () => {
    expect(activeDefectLevel1ForProcess(seedAccessState.masterData, "Laser Cutting").map((row) => row.name)).toEqual([
      "Drawing/specification nonconformance", "Cosmetic / appearance", "Material / component", "Functional / performance",
      "Process / workmanship", "Missing / incorrect part", "Other"
    ]);
  });

  it("filters Level 2 by both focused process and selected Level 1", () => {
    const reasons = activeDefectLevel2ForProcessAndLevel1(seedAccessState.masterData, "Pretreatment", "Cleaning & Chemical Treatment").map((row) => row.reason);
    expect(reasons).toEqual(["Poor cleaning", "Contamination", "Incomplete conversion coating"]);
    expect(activeDefectLevel2ForProcessAndLevel1(seedAccessState.masterData, "Pretreatment", "Surface Condition & Corrosion").map((row) => row.reason)).toEqual(["Flash rust", "Uneven pretreatment", "Surface corrosion"]);
    expect(activeDefectLevel2ForProcessAndLevel1(seedAccessState.masterData, "Pretreatment")).toEqual([]);
  });
});
