export type StageKey = "incoming" | "ipqa" | "oqa" | "complaints";

export type Contributor = { name: string; rejected: number };
export type Distribution = { name: string; value: number; color: string };
export type PartQuality = {
  partNumber: string;
  description: string;
  inspected: number;
  rejected: number;
  rejectionRate: number;
};

export type StageData = {
  key: StageKey;
  shortLabel: string;
  label: string;
  description: string;
  acceptanceRate: number;
  inspected: number;
  accepted: number;
  rejected: number;
  target: number;
  contributorLabel: string;
  contributors: Contributor[];
  categories: Distribution[];
  subDefects: Contributor[];
  parts: PartQuality[];
};

export const stageMeta: Record<StageKey, { label: string; shortLabel: string; icon: string }> = {
  incoming: { label: "Incoming", shortLabel: "IQC", icon: "IN" },
  ipqa: { label: "In-process", shortLabel: "IPQA", icon: "IP" },
  oqa: { label: "Outgoing", shortLabel: "OQA", icon: "OUT" },
  complaints: { label: "Customer complaints", shortLabel: "CCR", icon: "CC" }
};

export const stages: Record<StageKey, StageData> = {
  incoming: {
    key: "incoming", shortLabel: "IQC", label: "Incoming quality control", description: "Supplier receipt inspection across sheet stock, bar, and bought-out hardware.", acceptanceRate: 96.8, inspected: 12840, accepted: 12429, rejected: 411, target: 97, contributorLabel: "Top defect supplier",
    contributors: [{ name: "Apex Metals", rejected: 118 }, { name: "Mekong Precision", rejected: 96 }, { name: "NexForm Plating", rejected: 72 }, { name: "Kencana Fasteners", rejected: 51 }, { name: "Orion Alloys", rejected: 36 }],
    categories: [{ name: "Material", value: 34, color: "#d9773d" }, { name: "Dimension", value: 29, color: "#2c82c9" }, { name: "Surface finish", value: 21, color: "#4b9f78" }, { name: "Hardware", value: 10, color: "#8b73c2" }, { name: "Documentation", value: 6, color: "#9aa6b5" }],
    subDefects: [{ name: "Sheet thickness out of spec", rejected: 74 }, { name: "Flatness / camber", rejected: 59 }, { name: "Surface oxidation", rejected: 48 }, { name: "Wrong material grade", rejected: 41 }, { name: "Missing material cert", rejected: 25 }, { name: "Burrs on cut edge", rejected: 19 }],
    parts: [{ partNumber: "SM-4821", description: "Aluminium chassis panel", inspected: 1480, rejected: 82, rejectionRate: 5.54 }, { partNumber: "PM-1730", description: "CNC spacer 12 mm", inspected: 930, rejected: 44, rejectionRate: 4.73 }, { partNumber: "SM-3904", description: "Laser-cut bracket", inspected: 2120, rejected: 91, rejectionRate: 4.29 }, { partNumber: "PM-2248", description: "Turned stainless bushing", inspected: 680, rejected: 25, rejectionRate: 3.68 }, { partNumber: "SM-6108", description: "Powder-coated cover", inspected: 1740, rejected: 59, rejectionRate: 3.39 }]
  },
  ipqa: {
    key: "ipqa", shortLabel: "IPQA", label: "In-process quality assurance", description: "First-off and patrol checks at fabrication, machining, finishing, and assembly cells.", acceptanceRate: 94.9, inspected: 24360, accepted: 23117, rejected: 1243, target: 95, contributorLabel: "Top defect workstation",
    contributors: [{ name: "CNC Mill 04", rejected: 264 }, { name: "Laser Cell 02", rejected: 218 }, { name: "Press Brake 07", rejected: 179 }, { name: "Deburr Cell 01", rejected: 142 }, { name: "Assembly Bay B", rejected: 96 }],
    categories: [{ name: "Machining error", value: 38, color: "#2c82c9" }, { name: "Dimension", value: 27, color: "#d9773d" }, { name: "Surface finish", value: 18, color: "#4b9f78" }, { name: "Burr / edge", value: 11, color: "#8b73c2" }, { name: "Assembly", value: 6, color: "#9aa6b5" }],
    subDefects: [{ name: "Wrong dimensions", rejected: 206 }, { name: "Missing threads", rejected: 136 }, { name: "Burrs after machining", rejected: 121 }, { name: "Tool marks / scratches", rejected: 95 }, { name: "Hole position drift", rejected: 86 }, { name: "Incorrect bend angle", rejected: 71 }],
    parts: [{ partNumber: "PM-3017", description: "5-axis manifold block", inspected: 1080, rejected: 108, rejectionRate: 10.0 }, { partNumber: "SM-2241", description: "Formed electronics tray", inspected: 1380, rejected: 107, rejectionRate: 7.75 }, { partNumber: "PM-1730", description: "CNC spacer 12 mm", inspected: 2160, rejected: 152, rejectionRate: 7.04 }, { partNumber: "SM-4821", description: "Aluminium chassis panel", inspected: 1900, rejected: 127, rejectionRate: 6.68 }, { partNumber: "PM-1198", description: "Threaded actuator collar", inspected: 840, rejected: 54, rejectionRate: 6.43 }]
  },
  oqa: {
    key: "oqa", shortLabel: "OQA", label: "Outgoing quality assurance", description: "Final visual, dimensional, functional, and packaging release inspection before shipment.", acceptanceRate: 98.2, inspected: 11780, accepted: 11568, rejected: 212, target: 98, contributorLabel: "Top defect workstation",
    contributors: [{ name: "Final Inspection 03", rejected: 58 }, { name: "Packing Cell 02", rejected: 47 }, { name: "Final Inspection 01", rejected: 39 }, { name: "Functional Test 02", rejected: 28 }, { name: "Packing Cell 04", rejected: 19 }],
    categories: [{ name: "Surface finish", value: 31, color: "#4b9f78" }, { name: "Dimension", value: 25, color: "#2c82c9" }, { name: "Packaging", value: 21, color: "#d9773d" }, { name: "Function", value: 15, color: "#8b73c2" }, { name: "Labelling", value: 8, color: "#9aa6b5" }],
    subDefects: [{ name: "Scratches / dents", rejected: 42 }, { name: "Label mismatch", rejected: 31 }, { name: "Torque below spec", rejected: 28 }, { name: "Paint shade variation", rejected: 24 }, { name: "Wrong pack quantity", rejected: 21 }, { name: "Gauge calibration hold", rejected: 13 }],
    parts: [{ partNumber: "SM-6108", description: "Powder-coated cover", inspected: 1220, rejected: 31, rejectionRate: 2.54 }, { partNumber: "SM-3904", description: "Laser-cut bracket", inspected: 1760, rejected: 39, rejectionRate: 2.22 }, { partNumber: "PM-2248", description: "Turned stainless bushing", inspected: 930, rejected: 19, rejectionRate: 2.04 }, { partNumber: "SM-2011", description: "EMI shield enclosure", inspected: 1440, rejected: 26, rejectionRate: 1.81 }, { partNumber: "PM-4082", description: "Precision hinge pin", inspected: 680, rejected: 11, rejectionRate: 1.62 }]
  },
  complaints: {
    key: "complaints", shortLabel: "CCR", label: "Customer complaints", description: "External quality signals from field returns, customer claims, and containment actions.", acceptanceRate: 97.4, inspected: 1000, accepted: 974, rejected: 26, target: 97, contributorLabel: "Top customer account",
    contributors: [{ name: "Northstar Robotics", rejected: 9 }, { name: "Helix Automation", rejected: 6 }, { name: "Veridian Medical", rejected: 5 }, { name: "Axiom Energy", rejected: 3 }, { name: "Orion Mobility", rejected: 2 }],
    categories: [{ name: "Dimension", value: 35, color: "#2c82c9" }, { name: "Surface finish", value: 27, color: "#4b9f78" }, { name: "Function", value: 19, color: "#8b73c2" }, { name: "Packaging", value: 12, color: "#d9773d" }, { name: "Documentation", value: 7, color: "#9aa6b5" }],
    subDefects: [{ name: "Part out of tolerance", rejected: 8 }, { name: "Visible scratch", rejected: 6 }, { name: "Threading issue", rejected: 4 }, { name: "Early coating peel", rejected: 3 }, { name: "Wrong revision shipped", rejected: 3 }, { name: "Transit damage", rejected: 2 }],
    parts: [{ partNumber: "PM-3017", description: "5-axis manifold block", inspected: 90, rejected: 4, rejectionRate: 4.44 }, { partNumber: "SM-2241", description: "Formed electronics tray", inspected: 112, rejected: 4, rejectionRate: 3.57 }, { partNumber: "SM-4821", description: "Aluminium chassis panel", inspected: 156, rejected: 5, rejectionRate: 3.21 }, { partNumber: "PM-1198", description: "Threaded actuator collar", inspected: 88, rejected: 2, rejectionRate: 2.27 }, { partNumber: "SM-2011", description: "EMI shield enclosure", inspected: 142, rejected: 3, rejectionRate: 2.11 }]
  }
};

export const monthlyTrend = [
  { month: "Sep", incoming: 96.1, ipqa: 94.2, oqa: 97.0, complaints: 96.3 }, { month: "Oct", incoming: 96.4, ipqa: 94.8, oqa: 97.4, complaints: 96.5 }, { month: "Nov", incoming: 95.8, ipqa: 93.9, oqa: 97.7, complaints: 96.7 }, { month: "Dec", incoming: 96.9, ipqa: 94.5, oqa: 98.0, complaints: 96.9 }, { month: "Jan", incoming: 97.0, ipqa: 95.2, oqa: 98.3, complaints: 97.1 }, { month: "Feb", incoming: 96.5, ipqa: 94.9, oqa: 98.1, complaints: 96.8 }, { month: "Mar", incoming: 97.2, ipqa: 95.8, oqa: 98.5, complaints: 97.4 }, { month: "Apr", incoming: 97.4, ipqa: 95.1, oqa: 98.6, complaints: 97.2 }, { month: "May", incoming: 96.7, ipqa: 94.6, oqa: 98.0, complaints: 97.0 }, { month: "Jun", incoming: 97.3, ipqa: 95.5, oqa: 98.2, complaints: 97.3 }, { month: "Jul", incoming: 97.1, ipqa: 95.0, oqa: 98.4, complaints: 97.2 }, { month: "Aug", incoming: 96.8, ipqa: 94.9, oqa: 98.2, complaints: 97.4 }
];

const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const defectMonitoringMonths = allMonths.slice(0, new Date().getMonth() + 1);

export const defectMonthlyMatrix = [
  { name: "Dimensional out-of-tolerance", values: [18, 20, 19, 17, 24, 26, 22, 27, 0, 0, 0, 0] },
  { name: "Burrs / sharp edges", values: [14, 15, 16, 15, 18, 19, 17, 21, 0, 0, 0, 0] },
  { name: "Scratches / dents", values: [11, 12, 13, 12, 15, 16, 14, 17, 0, 0, 0, 0] },
  { name: "Plating / coating defect", values: [9, 10, 11, 10, 13, 14, 12, 15, 0, 0, 0, 0] },
  { name: "Packaging / label issue", values: [7, 8, 9, 8, 10, 11, 10, 12, 0, 0, 0, 0] }
];

export const topSignals = [
  { label: "Dimensional out-of-tolerance", count: 206, share: 24, tone: "orange" }, { label: "Burrs / sharp edges", count: 121, share: 14, tone: "blue" }, { label: "Scratches / dents", count: 95, share: 11, tone: "green" }, { label: "Plating / coating defect", count: 87, share: 10, tone: "purple" }
];
