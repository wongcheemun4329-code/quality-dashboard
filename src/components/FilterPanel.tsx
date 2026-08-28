import { useEffect, useMemo, useState } from "react";
import { Check, Filter, RotateCcw, Search, X } from "lucide-react";
import { cascadeStageFilters, DATA_END_DATE, defaultFilters, getFilterRelations, stageMeta, type ComplaintRecord, type DashboardFilters, type InspectionRecord, type OperationKey, type PeriodMode, type QuarterPeriod } from "../data/qualityData";
import { useLanguage } from "../i18n";

type Props = {
  rows: InspectionRecord[];
  operation: OperationKey;
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  customers?: string[];
  complaints?: ComplaintRecord[];
  compact?: boolean;
};

type DraftPeriod = Pick<DashboardFilters, "periodMode" | "preset" | "dayFrom" | "dayTo" | "monthFrom" | "monthTo" | "yearFrom" | "yearTo" | "quarterFrom" | "quarterTo" | "weekFrom" | "weekTo">;

function yearsFromData(rows: InspectionRecord[], complaints: ComplaintRecord[]) {
  const years = [...rows.map((row) => row.date.slice(0, 4)), ...complaints.map((row) => row.complaintDate.slice(0, 4))].map(Number).filter(Boolean);
  return Array.from(new Set(years)).sort((left, right) => left - right);
}

function quarterOrdinal(period: QuarterPeriod) {
  const [year, quarter] = period.split("-Q").map(Number);
  return year * 4 + quarter;
}

function weekOrdinal(period: string) {
  const [year, week] = period.split("-W").map(Number);
  return year * 100 + week;
}

function quarterLabel(period: QuarterPeriod) {
  const [year, quarter] = period.split("-");
  return `${quarter} ${year}`;
}

function periodLabel(filters: DashboardFilters, t: (key: string) => string) {
  if (filters.periodMode === "day-range") return `${filters.dayFrom}–${filters.dayTo}`;
  if (filters.periodMode === "week-range") return `${filters.weekFrom}–${filters.weekTo}`;
  if (filters.periodMode === "month-range") return `${filters.monthFrom}–${filters.monthTo}`;
  if (filters.periodMode === "year-range") return `${filters.yearFrom}–${filters.yearTo}`;
  if (filters.periodMode === "quarter-range") return `${filters.quarterFrom.split("-").reverse().join(" ")}–${filters.quarterTo.split("-").reverse().join(" ")}`;
  const labels: Record<DashboardFilters["preset"], string> = { "7d": t("last7Days"), "12m": t("rolling12"), "6m": t("last6"), "3m": t("last3"), ytd: t("yearToDate"), year: t("year2026"), q1: "Q1 2026", q2: "Q2 2026", q3: "Q3 2026", q4: "Q4 2026" };
  return labels[filters.preset];
}

function values(rows: InspectionRecord[], key: "supplier" | "partNumber") {
  return Array.from(new Set(rows.map((row) => row[key]))).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function FilterPanel({ rows, operation, filters, onChange, customers = [], complaints = [], compact = false }: Props) {
  const { language, t } = useLanguage();
  const local = (english: string, chinese: string) => language === "zh" ? chinese : english;
  const scopedRows = rows.filter((row) => operation === "all" || row.operation === operation);
  const complaintProcessValues = Array.from(new Set(complaints.filter((row) => operation === "all" || row.operation === operation).map((row) => row.process || "Unassigned"))).sort((left, right) => left.localeCompare(right));
  const years = useMemo(() => yearsFromData(rows, complaints), [rows, complaints]);
  const yearOptions = years.length ? years : [new Date(`${DATA_END_DATE}T00:00:00`).getFullYear()];
  const quarterOptions = yearOptions.flatMap((year) => ([1, 2, 3, 4] as const).map((quarter) => `${year}-Q${quarter}` as QuarterPeriod));
  const defaultDraft: DraftPeriod = { periodMode: filters.periodMode, preset: filters.preset, dayFrom: filters.dayFrom, dayTo: filters.dayTo, monthFrom: filters.monthFrom, monthTo: filters.monthTo, yearFrom: yearOptions.includes(filters.yearFrom) ? filters.yearFrom : yearOptions[0], yearTo: yearOptions.includes(filters.yearTo) ? filters.yearTo : yearOptions[yearOptions.length - 1], quarterFrom: quarterOptions.includes(filters.quarterFrom) ? filters.quarterFrom : quarterOptions[0], quarterTo: quarterOptions.includes(filters.quarterTo) ? filters.quarterTo : quarterOptions[quarterOptions.length - 1], weekFrom: filters.weekFrom, weekTo: filters.weekTo };
  const [draftPeriod, setDraftPeriod] = useState<DraftPeriod>(defaultDraft);
  useEffect(() => { setDraftPeriod(defaultDraft); }, [filters.periodMode, filters.preset, filters.dayFrom, filters.dayTo, filters.monthFrom, filters.monthTo, filters.yearFrom, filters.yearTo, filters.quarterFrom, filters.quarterTo, filters.weekFrom, filters.weekTo, yearOptions.join(","), quarterOptions.join(",")]);
  const incomingStage = filters.stage === "incoming";
  const complaintStage = filters.stage === "customer-complaint";
  const noInspectionStage = incomingStage;
  const supplierUnavailable = complaintStage || filters.stage === "in-process" || filters.stage === "outgoing";
  const relations = getFilterRelations(rows, operation, filters);
  const effectiveFilters = { ...filters, process: complaintStage ? filters.process : relations.effectiveProcess, workCenter: relations.effectiveWorkCenter, supplier: supplierUnavailable ? "all" : filters.supplier };
  const periodActive = filters.periodMode !== "preset" || filters.preset !== "12m";
  const periodKeys = new Set(["preset", "periodMode", "dayFrom", "dayTo", "monthFrom", "monthTo", "yearFrom", "yearTo", "quarterFrom", "quarterTo", "weekFrom", "weekTo"]);
  const activeEntries = (Object.entries(effectiveFilters) as Array<[keyof DashboardFilters, string]>).filter(([key, value]) => !periodKeys.has(key) && value && value !== "all");
  const filterLabels: Record<keyof DashboardFilters, string> = { preset: t("period"), periodMode: t("periodMode"), dayFrom: t("fromDate"), dayTo: t("toDate"), monthFrom: t("fromMonth"), monthTo: t("toMonth"), yearFrom: "From year", yearTo: "To year", quarterFrom: "From quarter", quarterTo: "To quarter", weekFrom: t("fromWeek"), weekTo: t("toWeek"), stage: t("stage"), process: t("processLabel"), workCenter: t("workCenter"), supplier: t("supplier"), customer: "Customer", partNumber: "Part", partType: t("partType"), shift: "Shift", search: "Search", defectCategory: "Defect", rejectCategoryLevel1: t("rejectCategoryLevel1"), rejectCategoryLevel2: t("rejectCategoryLevel2") };
  const update = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => onChange({ ...filters, [key]: value });
  const resetOne = (key: keyof DashboardFilters) => key === "stage"
    ? onChange(cascadeStageFilters(rows, operation, filters, defaultFilters.stage))
    : update(key, defaultFilters[key] as never);
  const updateStage = (stage: DashboardFilters["stage"]) => {
    onChange(cascadeStageFilters(rows, operation, filters, stage));
  };
  const updateProcess = (process: string) => {
    const next = { ...filters, process };
    if (complaintStage) { onChange(next); return; }
    const nextRelations = getFilterRelations(rows, operation, next);
    onChange({ ...next, process: nextRelations.effectiveProcess, workCenter: nextRelations.effectiveWorkCenter });
  };
  const customPeriodInvalid = draftPeriod.periodMode === "day-range" ? !draftPeriod.dayFrom || !draftPeriod.dayTo || draftPeriod.dayFrom > draftPeriod.dayTo : draftPeriod.periodMode === "month-range" ? !draftPeriod.monthFrom || !draftPeriod.monthTo || draftPeriod.monthFrom > draftPeriod.monthTo : draftPeriod.periodMode === "year-range" ? draftPeriod.yearFrom > draftPeriod.yearTo : draftPeriod.periodMode === "quarter-range" ? quarterOrdinal(draftPeriod.quarterFrom) > quarterOrdinal(draftPeriod.quarterTo) : draftPeriod.periodMode === "week-range" ? !draftPeriod.weekFrom || !draftPeriod.weekTo || weekOrdinal(draftPeriod.weekFrom) > weekOrdinal(draftPeriod.weekTo) : false;
  const selectPeriodMode = (mode: PeriodMode) => {
    if (mode === "preset") {
      const next = { ...filters, periodMode: "preset" as const };
      onChange(next);
      setDraftPeriod({ ...draftPeriod, periodMode: "preset" });
    } else {
      setDraftPeriod({ ...draftPeriod, periodMode: mode });
    }
  };
  const applyCustomPeriod = () => {
    if (customPeriodInvalid || draftPeriod.periodMode === "preset") return;
    onChange({ ...filters, ...draftPeriod });
  };
  const resetPeriod = () => onChange({ ...filters, periodMode: defaultFilters.periodMode, preset: defaultFilters.preset, dayFrom: defaultFilters.dayFrom, dayTo: defaultFilters.dayTo, monthFrom: defaultFilters.monthFrom, monthTo: defaultFilters.monthTo, yearFrom: defaultFilters.yearFrom, yearTo: defaultFilters.yearTo, quarterFrom: defaultFilters.quarterFrom, quarterTo: defaultFilters.quarterTo, weekFrom: defaultFilters.weekFrom, weekTo: defaultFilters.weekTo });

  return (
    <section className={`filter-panel ${compact ? "filter-panel--compact" : ""}`} aria-label="Quality filters">
      <div className="filter-panel__title"><Filter size={15} /><strong>{t("filters")}</strong><span>{periodActive || activeEntries.length ? `${activeEntries.length + (periodActive ? 1 : 0)} ${t("active")}` : t("defaultView")}</span><button type="button" onClick={() => onChange(defaultFilters)} disabled={!activeEntries.length && !periodActive}><RotateCcw size={14} />{t("reset")}</button></div>
      <div className="filter-grid">
        <label><span>{t("periodMode")}</span><select aria-label={t("periodMode")} value={draftPeriod.periodMode} onChange={(event) => selectPeriodMode(event.target.value as PeriodMode)}><option value="day-range">{t("dayRange")}</option><option value="week-range">{t("weekRange")}</option><option value="month-range">{t("monthRange")}</option><option value="quarter-range">{t("quarterRange")}</option><option value="year-range">{t("yearRange")}</option><option value="preset">{t("quickPreset")}</option></select></label>
        {draftPeriod.periodMode === "preset" ? <label><span>{t("period")}</span><select aria-label={t("period")} value={filters.preset} onChange={(event) => onChange({ ...filters, periodMode: "preset", preset: event.target.value as DashboardFilters["preset"] })}><option value="7d">{t("last7Days")}</option><option value="12m">{t("rolling12")}</option><option value="6m">{t("last6")}</option><option value="3m">{t("last3")}</option><option value="ytd">{t("yearToDate")}</option><option value="year">{t("year2026")}</option><option value="q1">Q1 2026</option><option value="q2">Q2 2026</option><option value="q3">Q3 2026</option><option value="q4">Q4 2026</option></select></label> : null}
        {draftPeriod.periodMode === "day-range" ? <><label><span>{t("fromDate")}</span><input aria-label={t("fromDate")} type="date" value={draftPeriod.dayFrom} onChange={(event) => setDraftPeriod({ ...draftPeriod, dayFrom: event.target.value })} /></label><label><span>{t("toDate")}</span><input aria-label={t("toDate")} type="date" value={draftPeriod.dayTo} onChange={(event) => setDraftPeriod({ ...draftPeriod, dayTo: event.target.value })} /></label></> : null}
        {draftPeriod.periodMode === "week-range" ? <><label><span>{t("fromWeek")}</span><input aria-label={t("fromWeek")} type="week" value={draftPeriod.weekFrom} onChange={(event) => setDraftPeriod({ ...draftPeriod, weekFrom: event.target.value })} /></label><label><span>{t("toWeek")}</span><input aria-label={t("toWeek")} type="week" value={draftPeriod.weekTo} onChange={(event) => setDraftPeriod({ ...draftPeriod, weekTo: event.target.value })} /></label></> : null}
        {draftPeriod.periodMode === "month-range" ? <><label><span>{t("fromMonth")}</span><input aria-label={t("fromMonth")} type="month" value={draftPeriod.monthFrom} onChange={(event) => setDraftPeriod({ ...draftPeriod, monthFrom: event.target.value })} /></label><label><span>{t("toMonth")}</span><input aria-label={t("toMonth")} type="month" value={draftPeriod.monthTo} onChange={(event) => setDraftPeriod({ ...draftPeriod, monthTo: event.target.value })} /></label></> : null}
        {draftPeriod.periodMode === "year-range" ? <><label><span>{local("From year", "起始年份")}</span><select aria-label={local("From year", "起始年份")} value={draftPeriod.yearFrom} onChange={(event) => setDraftPeriod({ ...draftPeriod, yearFrom: Number(event.target.value) })}>{yearOptions.map((year) => <option key={year}>{year}</option>)}</select></label><label><span>{local("To year", "结束年份")}</span><select aria-label={local("To year", "结束年份")} value={draftPeriod.yearTo} onChange={(event) => setDraftPeriod({ ...draftPeriod, yearTo: Number(event.target.value) })}>{yearOptions.map((year) => <option key={year}>{year}</option>)}</select></label></> : null}
        {draftPeriod.periodMode === "quarter-range" ? <><label><span>{local("From quarter", "起始季度")}</span><select aria-label={local("From quarter", "起始季度")} value={draftPeriod.quarterFrom} onChange={(event) => setDraftPeriod({ ...draftPeriod, quarterFrom: event.target.value as QuarterPeriod })}>{quarterOptions.map((quarter) => <option key={quarter} value={quarter}>{quarterLabel(quarter)}</option>)}</select></label><label><span>{local("To quarter", "结束季度")}</span><select aria-label={local("To quarter", "结束季度")} value={draftPeriod.quarterTo} onChange={(event) => setDraftPeriod({ ...draftPeriod, quarterTo: event.target.value as QuarterPeriod })}>{quarterOptions.map((quarter) => <option key={quarter} value={quarter}>{quarterLabel(quarter)}</option>)}</select></label></> : null}
        {draftPeriod.periodMode !== "preset" ? <div className="period-apply"><button type="button" onClick={applyCustomPeriod} disabled={customPeriodInvalid}><Check size={13} />Apply</button>{customPeriodInvalid ? <small role="alert">End period must be on or after start period.</small> : null}</div> : null}
        <label><span>{t("stage")}</span><select aria-label={t("stage")} value={filters.stage} onChange={(event) => updateStage(event.target.value as DashboardFilters["stage"])}><option value="all">{t("allStages")}</option>{(Object.keys(stageMeta) as Array<keyof typeof stageMeta>).map((key) => <option key={key} value={key}>{key === "incoming" ? t("incoming") : key === "in-process" ? t("inProcess") : t("outgoing")}</option>)}<option value="customer-complaint">{t("customerComplaintStage")}</option></select></label>
        <label><span>{t("processLabel")}</span><select aria-label={t("processLabel")} disabled={noInspectionStage} value={noInspectionStage ? "all" : complaintStage ? filters.process : relations.effectiveProcess} onChange={(event) => updateProcess(event.target.value)}><option value="all">{incomingStage ? t("notApplicableIncoming") : t("allProcesses")}</option>{complaintStage ? complaintProcessValues.map((value) => <option key={value}>{value}</option>) : relations.processValues.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>{t("workCenter")}</span><select aria-label={t("workCenter")} disabled={noInspectionStage || complaintStage} value={noInspectionStage || complaintStage ? "all" : relations.effectiveWorkCenter} onChange={(event) => update("workCenter", event.target.value)}><option value="all">{complaintStage ? t("notApplicableComplaint") : incomingStage ? t("notApplicableIncoming") : t("allWorkCenters")}</option>{!noInspectionStage && !complaintStage ? relations.workCenterValues.map((value) => <option key={value}>{value}</option>) : null}</select></label>
        <label><span>{t("supplier")}</span><select aria-label={t("supplier")} disabled={supplierUnavailable} value={supplierUnavailable ? "all" : filters.supplier} onChange={(event) => update("supplier", event.target.value)}><option value="all">{complaintStage ? t("notApplicableComplaint") : supplierUnavailable ? t("notApplicableFlow") : t("allSuppliers")}</option>{!supplierUnavailable ? values(scopedRows, "supplier").map((value) => <option key={value}>{value}</option>) : null}</select></label>
        <label><span>{t("partType")}</span><select aria-label={t("partType")} value={filters.partType} onChange={(event) => update("partType", event.target.value as DashboardFilters["partType"])}><option value="all">{t("allPartTypes")}</option><option value="NPI">NPI</option><option value="Production">{t("production")}</option></select></label>
        {!compact ? <>
        <label><span>Customer</span><select aria-label="Customer" value={filters.customer} onChange={(event) => update("customer", event.target.value)}><option value="all">All customers</option>{[...customers].sort((a, b) => a.localeCompare(b)).map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Part</span><select aria-label="Part" value={filters.partNumber} onChange={(event) => update("partNumber", event.target.value)}><option value="all">All parts</option>{values(scopedRows, "partNumber").map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Shift</span><select aria-label="Shift" value={filters.shift} onChange={(event) => update("shift", event.target.value as DashboardFilters["shift"])}><option value="all">All shifts</option><option value="Day">Day</option><option value="Night">Night</option></select></label>
        <label className="search-field"><span>Search records</span><Search size={14} /><input aria-label="Search records" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="ID, part, work order..." /></label></> : null}
      </div>
      {periodActive || activeEntries.length ? <div className="filter-chips" aria-label={t("filters")}>{periodActive ? <button type="button" onClick={resetPeriod}>{t("period")}: {periodLabel(filters, t)}<X size={12} /></button> : null}{activeEntries.map(([key, value]) => <button key={key} type="button" onClick={() => resetOne(key)}>{filterLabels[key]}: {key === "stage" ? (value === "incoming" ? t("incoming") : value === "in-process" ? t("inProcess") : value === "outgoing" ? t("outgoing") : t("customerComplaintStage")) : value}<X size={12} /></button>)}</div> : null}
    </section>
  );
}
