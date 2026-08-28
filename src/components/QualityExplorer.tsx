import { useMemo, useState } from "react";
import { CircleDollarSign, Download, SearchX } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aggregateRejectCategoryLevel2Matrix, calculateMetrics, downloadQualityWorkbook, filterComplaints, filterInspections, getDateRange, groupSum, operationMeta, stageMeta, type DashboardFilters, type InspectionStage, type OperationKey, type QualityDataset } from "../data/qualityData";
import { ChartWidget, chartTooltipStyle } from "./ChartWidget";
import { FilterPanel } from "./FilterPanel";
import { useLanguage } from "../i18n";
import { InspectionTable } from "./InspectionTable";
import { Level2MatrixChart } from "./Level2MatrixChart";

type Props = { dataset: QualityDataset; operation: OperationKey; filters: DashboardFilters; onFiltersChange: (filters: DashboardFilters) => void };
const currency = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });
type Level2Limit = 0 | 5;

export function QualityExplorer({ dataset, operation, filters, onFiltersChange }: Props) {
  const { t } = useLanguage();
  const [level2Limit, setLevel2Limit] = useState<Level2Limit>(0);
  const range = getDateRange(filters);
  const inspections = useMemo(() => filterInspections(dataset.inspections, operation, filters, range).sort((a, b) => b.date.localeCompare(a.date)), [dataset, operation, filters, range.start, range.end]);
  const complaints = useMemo(() => filterComplaints(dataset.complaints, operation, range, filters), [dataset, operation, filters, range.start, range.end]);
  const metrics = calculateMetrics(inspections, complaints);
  const defectMatrix = aggregateRejectCategoryLevel2Matrix(inspections, filters, range, level2Limit);
  const rootCauseData = groupSum(inspections, (row) => row.rootCause, (row) => row.reworkQty + row.scrapQty).slice(0, 8);
  const processData = Array.from(new Set(inspections.map((row) => row.process))).map((process) => {
    const rows = inspections.filter((row) => row.process === process);
    const result = calculateMetrics(rows, []);
    return { name: process, fpy: result.fpy ? Number(result.fpy.toFixed(1)) : 0, scrapCost: rows.reduce((sum, row) => sum + row.scrapCost, 0) };
  }).sort((a, b) => a.fpy - b.fpy);
  const reset = () => onFiltersChange({ ...filters, stage: "all", process: "all", workCenter: "all", supplier: "all", customer: "all", partNumber: "all", partType: "all", shift: "all", search: "", defectCategory: "all", rejectCategoryLevel1: "all", rejectCategoryLevel2: "all" });
  const setStage = (stage: InspectionStage | "all") => onFiltersChange({ ...filters, stage });

  return <div className="page-stack">
    <section className="page-header"><div><div className="eyebrow">QUALITY ENGINEERING WORKSPACE</div><h1>{operationMeta[operation].label} Explorer</h1><p>Investigate defects, processes, parts, suppliers, and inspection records</p></div><button className="secondary-button" type="button" onClick={() => downloadQualityWorkbook({ ...dataset, inspections, complaints }, "filtered-quality-records.xlsx")}><Download size={15} />Export filtered XLSX</button></section>

    <div className="stage-tabs" role="tablist" aria-label="Inspection stage"><button type="button" className={filters.stage === "all" ? "active" : ""} onClick={() => setStage("all")}>All stages</button>{(Object.keys(stageMeta) as InspectionStage[]).map((stage) => <button type="button" key={stage} className={filters.stage === stage ? "active" : ""} onClick={() => setStage(stage)}><span>{stageMeta[stage].shortLabel}</span>{stageMeta[stage].label}</button>)}</div>
    <FilterPanel rows={dataset.inspections} operation={operation} filters={filters} onChange={onFiltersChange} customers={Array.from(new Set(dataset.complaints.map((row) => row.customer)))} complaints={dataset.complaints} />

    <section className="explorer-summary">
      <div><span>Filtered records</span><strong>{inspections.length}</strong></div><div><span>Inspected quantity</span><strong>{metrics.inspectedQty.toLocaleString()}</strong></div><div><span>Acceptance rate</span><strong>{metrics.fpy === null ? "—" : `${metrics.fpy.toFixed(1)}%`}</strong></div><div><span>Rejected units</span><strong>{(metrics.reworkQty + metrics.scrapQty).toLocaleString()}</strong></div><div><span>Internal failure cost</span><strong>{currency.format(inspections.reduce((sum, row) => sum + row.scrapCost + row.reworkCost, 0))}</strong></div>
    </section>

    {inspections.length ? <section className="dashboard-grid explorer-grid">
      <ChartWidget title={t("rejectCategoryLevel2")} subtitle={t("rejectCategoryLevel2MatrixSubtitle")} action={<><label className="trend-select"><span>{t("show")}</span><select aria-label={t("rejectCategoryLevel2")} value={level2Limit} onChange={(event) => setLevel2Limit(Number(event.target.value) as Level2Limit)}><option value={5}>{t("top")} 5</option><option value={0}>{t("allLevel2Reasons")}</option></select></label><span className="chart-note">{defectMatrix.granularity}</span>{filters.rejectCategoryLevel2 !== "all" ? <button className="text-button" type="button" onClick={() => onFiltersChange({ ...filters, rejectCategoryLevel2: "all" })}>{t("clearLevel2")}</button> : null}{filters.defectCategory !== "all" ? <button className="text-button" type="button" onClick={() => onFiltersChange({ ...filters, defectCategory: "all" })}>{t("clearDefect")}</button> : null}</>} className="chart-card--wide" resizable>
        <Level2MatrixChart data={defectMatrix} selectedKey={filters.rejectCategoryLevel2} quantityLabel={t("rejectedUnits")} periodLabel={t("period")} onSelect={(key) => onFiltersChange({ ...filters, rejectCategoryLevel2: key })} />
      </ChartWidget>
      <ChartWidget title="Root-cause distribution" subtitle="Rejected units by assigned root cause">
        <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={rootCauseData}><CartesianGrid stroke="#e6ebef" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} interval={0} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} /><Tooltip contentStyle={chartTooltipStyle} /><Bar dataKey="value" name="Rejected units" fill="#487f8f" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </ChartWidget>
      <ChartWidget title="Process capability signal" subtitle="Lower acceptance-rate processes rank first" action={<span className="chart-note"><CircleDollarSign size={12} /> Scrap cost</span>} className="chart-card--wide">
        <div className="process-table"><div className="process-table__head"><span>Process</span><span>Acceptance</span><span>Scrap cost</span><span>Signal</span></div>{processData.map((row) => <button key={row.name} type="button" onClick={() => onFiltersChange({ ...filters, process: row.name })}><strong>{row.name}</strong><span>{row.fpy.toFixed(1)}%</span><span>{currency.format(row.scrapCost)}</span><i><em className={row.fpy >= 97 ? "good" : row.fpy >= 95 ? "watch" : "bad"} style={{ width: `${row.fpy}%` }} /></i></button>)}</div>
      </ChartWidget>
      <ChartWidget title="Inspection records" subtitle={`${inspections.length} filtered records · Showing latest ${Math.min(20, inspections.length)}`} action={<span className="chart-note">Cross-filtered</span>} className="chart-card--full"><InspectionTable rows={inspections} /></ChartWidget>
    </section> : <section className="no-results"><SearchX size={28} /><strong>No matching quality records</strong><p>Remove one or more filters to restore the inspection dataset.</p><button type="button" onClick={reset}>Reset filters</button></section>}
  </div>;
}
