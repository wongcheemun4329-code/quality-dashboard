import { useMemo, useState, type DragEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aggregateComplaintRejectCategoryLevel2Matrix, aggregateComplaintTrendData, aggregateCustomerComplaintPerformance, aggregatePartContributions, aggregatePartTypeTrendData, aggregateRejectCategoryLevel2Matrix, aggregateTrendData, calculateComplaintMetrics, calculateMetrics, cascadeStageFilters, defaultFilters, filterComplaints, filterInspections, getDateRange, getPartTypeTrendYAxisDomain, getTrendGranularity, getTrendXAxisInterval, getTrendYAxisDomain, groupComplaintRecords, groupComplaintRejectCategories, groupRejectCategories, groupSum, operationMeta, type ComplaintMetrics, type DashboardFilters, type OperationKey, type PartContributionSummary, type QualityDataset, type QualityMetrics } from "../data/qualityData";
import { operationLabel, useLanguage } from "../i18n";
import { ChartWidget, chartTooltipStyle } from "./ChartWidget";
import { FilterPanel } from "./FilterPanel";
import { Level2MatrixChart } from "./Level2MatrixChart";

type Props = { dataset: QualityDataset; operation: OperationKey; filters: DashboardFilters; onFiltersChange: (filters: DashboardFilters) => void; onOpenExplorer: () => void };
type TrendMetric = "acceptance" | "qppm" | "partType";
type TrendChartPoint = { key: string; label: string; fpy: number | null; rejectPpm?: number | null; rollingQppm?: number | null; npiQuantity?: number; productionQuantity?: number; totalQuantity?: number; scrapCost?: number; reworkCost?: number; externalScrapCost?: number; externalReworkCost?: number; internal?: number; external?: number };
type ProcessMetric = "quantity" | "cost";
type CustomerExposureMetric = "quantity" | "cost" | "complaintPpm";
type StageExposureMetric = "quantity" | "cost";
type Level2Limit = 0 | 5;
type KpiId = "incoming" | "ipqa" | "oqa" | "complaint" | "overallQuality" | "overallCopq" | "overallScrap";
type AnalysisId = "defects" | "cost" | "internalCost" | "workCenters" | "parts" | "suppliers" | "complaints";
type DropPosition = "before" | "after";
const defaultKpiOrder: KpiId[] = ["overallQuality", "overallCopq", "overallScrap", "incoming", "ipqa", "oqa", "complaint"];
// Keep the aggregate dashboard's established order as the initial layout. Once
// a user moves a section, this order is persisted and used in every stage view.
const defaultAnalysisOrder: AnalysisId[] = ["complaints", "cost", "defects", "internalCost", "parts", "suppliers", "workCenters"];
const defaultComplaintAnalysisOrder: AnalysisId[] = ["cost", "defects", "parts", "suppliers", "workCenters", "complaints"];
const kpiLabels: Record<KpiId, string> = { incoming: "Incoming", ipqa: "IPQA", oqa: "OQA", complaint: "Customer Complaint", overallQuality: "Overall Quality", overallCopq: "Overall Cost of Quality", overallScrap: "Overall Scrap %" };
const KPI_LAYOUT_KEY = "manufacturing-quality-kpi-layout-v2";
const LEGACY_KPI_LAYOUT_KEY = "manufacturing-quality-kpi-layout-v1";
const ANALYSIS_LAYOUT_KEY = "manufacturing-quality-analysis-layout-v1";
const COMPLAINT_ANALYSIS_LAYOUT_KEY = "manufacturing-quality-complaint-analysis-layout-v1";
const currency = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });

/** Reorder only the items currently visible, leaving hidden items in their slots. */
export function reorderVisibleItems<T extends string>(fullOrder: T[], visibleOrder: T[], dragged: T, target: T, position: DropPosition = "before") {
  if (dragged === target || !fullOrder.includes(dragged) || !visibleOrder.includes(dragged) || !visibleOrder.includes(target)) return fullOrder;
  const visible = fullOrder.filter((item) => visibleOrder.includes(item));
  const remaining = visible.filter((item) => item !== dragged);
  const targetIndex = remaining.indexOf(target);
  if (targetIndex < 0) return fullOrder;
  remaining.splice(targetIndex + (position === "after" ? 1 : 0), 0, dragged);
  const visibleSlots = fullOrder.reduce<number[]>((slots, item, index) => {
    if (visible.includes(item)) slots.push(index);
    return slots;
  }, []);
  const next = [...fullOrder];
  visibleSlots.forEach((slot, index) => { next[slot] = remaining[index]; });
  return next;
}

function readKpiOrder(): KpiId[] {
  try {
    // The v2 management layout intentionally supersedes any v1 arrangement.
    if (localStorage.getItem(KPI_LAYOUT_KEY) === null) localStorage.removeItem(LEGACY_KPI_LAYOUT_KEY);
    const stored = JSON.parse(localStorage.getItem(KPI_LAYOUT_KEY) ?? "null") as unknown;
    if (Array.isArray(stored)) {
      const migrated = stored.filter((item): item is KpiId => defaultKpiOrder.includes(item as KpiId));
      const next = [...new Set([...migrated, ...defaultKpiOrder])];
      if (next.length === defaultKpiOrder.length && next.every((item) => defaultKpiOrder.includes(item))) return next;
    }
  } catch { /* use the default layout */ }
  return defaultKpiOrder;
}

function readAnalysisOrder(): AnalysisId[] {
  try {
    const stored = JSON.parse(localStorage.getItem(ANALYSIS_LAYOUT_KEY) ?? "null") as unknown;
    if (Array.isArray(stored)) {
      const migrated = [...new Set(stored.filter((item): item is AnalysisId => defaultAnalysisOrder.includes(item as AnalysisId)))];
      const legacyIds = defaultAnalysisOrder.filter((item) => item !== "internalCost");
      if (legacyIds.every((item) => migrated.includes(item))) {
        if (!migrated.includes("internalCost")) migrated.splice(Math.max(0, migrated.indexOf("parts")), 0, "internalCost");
        if (migrated.length === defaultAnalysisOrder.length) return migrated;
      }
    }
  } catch { /* use the default layout */ }
  return defaultAnalysisOrder;
}

function readComplaintAnalysisOrder(): AnalysisId[] {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPLAINT_ANALYSIS_LAYOUT_KEY) ?? "null") as unknown;
    if (Array.isArray(stored) && stored.length === defaultComplaintAnalysisOrder.length && stored.every((item) => defaultComplaintAnalysisOrder.includes(item as AnalysisId))) return stored as AnalysisId[];
  } catch { /* use the default complaint layout */ }
  return defaultComplaintAnalysisOrder;
}

function formatMetric(key: keyof QualityMetrics, value: number | null) {
  if (value === null) return "—";
  if (key === "fpy" || key === "scrapRate" || key === "inspectionCompletion") return `${value.toFixed(1)}%`;
  if (key === "rejectPpm") return Math.round(value).toLocaleString();
  if (key === "copq" || key === "rejectionCost") return currency.format(value);
  return Math.round(value).toLocaleString();
}

function localizeTrendLabel(label: string, language: "en" | "zh") {
  if (language === "en") return label;
  const day = label.match(/^(\d{2}) ([A-Za-z]+)$/);
  if (day) {
    const monthNames: Record<string, string> = { Jan: "1月", Feb: "2月", Mar: "3月", Apr: "4月", May: "5月", Jun: "6月", Jul: "7月", Aug: "8月", Sep: "9月", Sept: "9月", Oct: "10月", Nov: "11月", Dec: "12月" };
    return `${monthNames[day[2]] ?? day[2]}${Number(day[1])}日`;
  }
  const week = label.match(/^(\d{4})-W(\d{2})$/);
  if (week) return `${week[1]}年第${Number(week[2])}周`;
  const quarter = label.match(/^Q([1-4]) (\d{4})$/);
  if (quarter) return `${quarter[2]}年 Q${quarter[1]}`;
  const year = label.match(/^\d{4}$/);
  if (year) return `${label}年`;
  const monthNames: Record<string, string> = { Jan: "1月", Feb: "2月", Mar: "3月", Apr: "4月", May: "5月", Jun: "6月", Jul: "7月", Aug: "8月", Sept: "9月", Oct: "10月", Nov: "11月", Dec: "12月" };
  const month = label.match(/^([A-Za-z]+) (\d{2})$/);
  return month ? `${monthNames[month[1]] ?? month[1]} ${Number(month[2]) + 2000}年` : label;
}

function statusForMetrics(fpy: number | null, targetFpy: number | undefined, rejectPpm: number | null, targetRejectPpm: number | undefined) {
  if (fpy === null || rejectPpm === null) return { label: "info", tone: "info" };
  if (targetFpy !== undefined && targetRejectPpm !== undefined && fpy >= targetFpy && rejectPpm <= targetRejectPpm) return { label: "good", tone: "good" };
  if (targetFpy !== undefined && targetRejectPpm !== undefined && fpy >= targetFpy * 0.995 && rejectPpm <= targetRejectPpm * 1.1) return { label: "watch", tone: "watch" };
  return { label: "action", tone: "action" };
}

function CompactMetricCard({ title, fpy, targetFpy, rejectPpm, targetRejectPpm, rejectionCost, status }: { title: string; fpy: number | null; targetFpy?: number; rejectPpm: number | null; targetRejectPpm?: number; rejectionCost: number; status?: { label: string; tone: string } }) {
  const { t } = useLanguage();
  const resolvedStatus = status ?? statusForMetrics(fpy, targetFpy, rejectPpm, targetRejectPpm);
  return <article className={`metric-card metric-card--compact metric-card--${resolvedStatus.tone}`}><div className="metric-card__top"><span>{title}</span><i className="metric-status-pill">{t(resolvedStatus.label)}</i></div><strong className="metric-card__primary">{fpy === null ? t("notAvailable") : fpy.toFixed(1)}<small>% FPY</small></strong><div className="compact-card-row"><span>{t("rejectPpm")}</span><strong>{formatMetric("rejectPpm", rejectPpm)}</strong></div><div className="compact-card-row"><span>{t("rejectionCost")}</span><strong>{currency.format(rejectionCost)}</strong></div></article>;
}

function PartTypeMetricCard({ title, group, targetFpy, targetRejectPpm }: { title: string; group: PartContributionSummary; targetFpy?: number; targetRejectPpm?: number }) {
  const { t } = useLanguage();
  const fpy = group.inspectedQty ? 100 - (group.rejectedQty / group.inspectedQty) * 100 : null;
  const rejectPpm = group.inspectedQty ? (group.rejectedQty / group.inspectedQty) * 1_000_000 : null;
  const status = statusForMetrics(fpy, targetFpy, rejectPpm, targetRejectPpm);
  return <article className={`metric-card metric-card--compact metric-card--${status.tone}`}><div className="metric-card__top"><span>{title}</span><i className="metric-status-pill">{t(status.label)}</i></div><strong className="metric-card__primary">{fpy === null ? t("notAvailable") : fpy.toFixed(1)}<small>% FPY</small></strong><div className="compact-card-row"><span>{t("rejectPpm")}</span><strong>{rejectPpm === null ? t("notAvailable") : Math.round(rejectPpm).toLocaleString()}</strong></div><div className="compact-card-row"><span>{t("rejectionCost")}</span><strong>{currency.format(group.failureCost)}</strong></div></article>;
}

function ComplaintMetricCard({ title, metrics, targetFpy, targetRejectPpm }: { title: string; metrics: ComplaintMetrics; targetFpy?: number; targetRejectPpm?: number }) {
  const status = statusForMetrics(metrics.fpy, targetFpy, metrics.rejectPpm, targetRejectPpm);
  const { t } = useLanguage();
  return <article className={`metric-card metric-card--compact metric-card--${status.tone}`}><div className="metric-card__top"><span>{title}</span><i className="metric-status-pill">{t(status.label)}</i></div><strong className="metric-card__primary">{metrics.fpy === null ? t("notAvailable") : metrics.fpy.toFixed(2)}<small>% FPY</small></strong><div className="compact-card-row"><span>{t("rejectPpm")}</span><strong>{metrics.rejectPpm === null ? t("notAvailable") : Math.round(metrics.rejectPpm).toLocaleString()}</strong></div><div className="compact-card-row"><span>{t("rejectionCost")}</span><strong>{currency.format(metrics.rejectionCost)}</strong></div><div className="compact-card-context"><span>{t("delivered")}: {metrics.deliveredQty.toLocaleString()}</span><span>{t("affectedQty")}: {metrics.affectedQty.toLocaleString()}</span><span>{t("complaintCases")}: {metrics.complaintCount}</span></div></article>;
}

function MetricSummaryValue({ label, value, suffix, decimals = 1 }: { label: string; value: number | null; suffix?: string; decimals?: number }) {
  const { t } = useLanguage();
  const formatted = value === null ? t("notAvailable") : decimals === 0 ? Math.round(value).toLocaleString() : value.toFixed(decimals);
  return <div className="metric-summary-card__value"><span>{label}</span><strong>{formatted}{suffix && value !== null ? <small>{suffix}</small> : null}</strong></div>;
}

function SummaryStatusValue({ label, value, suffix, decimals = 1, status }: { label: string; value: number | null; suffix?: string; decimals?: number; status: { label: string; tone: string } }) {
  const { t } = useLanguage();
  const formatted = value === null ? t("notAvailable") : decimals === 0 ? Math.round(value).toLocaleString() : value.toFixed(decimals);
  return <div className="metric-summary-card__value"><div className="metric-summary-card__value-label"><span>{label}</span><i className={`metric-summary-card__status metric-summary-card__status--${status.tone}`}>{t(status.label)}</i></div><strong>{formatted}{suffix && value !== null ? <small>{suffix}</small> : null}</strong></div>;
}

function StageSummaryValue({ label, metrics, targetFpy, targetRejectPpm }: { label: string; metrics: QualityMetrics; targetFpy: number; targetRejectPpm: number }) {
  const status = statusForMetrics(metrics.fpy, targetFpy, metrics.rejectPpm, targetRejectPpm);
  return <SummaryStatusValue label={label} value={metrics.fpy} suffix="%" status={status} />;
}

function InspectionStagesSummaryCard({ metrics, targetFpy, targetRejectPpm }: { metrics: { incoming: QualityMetrics; ipqa: QualityMetrics; oqa: QualityMetrics }; targetFpy: number; targetRejectPpm: number }) {
  const { t } = useLanguage();
  return <article className="metric-summary-card metric-summary-card--inspection"><div className="metric-summary-card__header"><strong>{t("incomingKpi")} · {t("ipqaKpi")} · {t("oqaKpi")}</strong><span>{t("inspectionStagesLabel")}</span></div><div className="metric-summary-card__values"><StageSummaryValue label={`${t("incomingKpi")} FPY`} metrics={metrics.incoming} targetFpy={targetFpy} targetRejectPpm={targetRejectPpm} /><StageSummaryValue label={`${t("ipqaKpi")} FPY`} metrics={metrics.ipqa} targetFpy={targetFpy} targetRejectPpm={targetRejectPpm} /><StageSummaryValue label={`${t("oqaKpi")} FPY`} metrics={metrics.oqa} targetFpy={targetFpy} targetRejectPpm={targetRejectPpm} /></div></article>;
}

function PartLifecycleSummaryCard({ groups, combinedFpy, combinedRejectPpm, targetFpy, targetRejectPpm }: { groups: PartContributionSummary[]; combinedFpy: number | null; combinedRejectPpm: number | null; targetFpy: number; targetRejectPpm: number }) {
  const { t } = useLanguage();
  const npi = groups.find((group) => group.partType === "NPI");
  const production = groups.find((group) => group.partType === "Production");
  const fpy = (group: PartContributionSummary | undefined) => group?.inspectedQty ? 100 - (group.rejectedQty / group.inspectedQty) * 100 : null;
  const groupStatus = (group: PartContributionSummary | undefined) => statusForMetrics(fpy(group), targetFpy, group?.inspectedQty ? (group.rejectedQty / group.inspectedQty) * 1_000_000 : null, targetRejectPpm);
  const combinedStatus = statusForMetrics(combinedFpy, targetFpy, combinedRejectPpm, targetRejectPpm);
  return <article className="metric-summary-card metric-summary-card--lifecycle"><div className="metric-summary-card__header"><strong>{t("partLifecycleTitle")}</strong><span>{t("partLifecycleLabel")}</span></div><div className="metric-summary-card__values"><SummaryStatusValue label={`${t("npi")} FPY`} value={fpy(npi)} suffix="%" status={groupStatus(npi)} /><SummaryStatusValue label={`${t("production")} FPY`} value={fpy(production)} suffix="%" status={groupStatus(production)} /><SummaryStatusValue label={t("combinedPpm")} value={combinedRejectPpm === null ? null : Math.round(combinedRejectPpm)} decimals={0} status={combinedStatus} /></div><span className="metric-summary-card__legacy-label">{t("npiParts")}</span><span className="metric-summary-card__legacy-label">{t("productionParts")}</span></article>;
}

function OverallSingleMetricCard({ title, metricKey, value, target, lowerIsBetter }: { title: string; metricKey: "copq" | "scrapRate"; value: number | null; target: number; lowerIsBetter: boolean }) {
  const { t } = useLanguage();
  const onTarget = value !== null && (lowerIsBetter ? value <= target : value >= target);
  const watch = value !== null && (lowerIsBetter ? value <= target * 1.1 : value >= target * 0.995);
  const tone = value === null ? "info" : onTarget ? "good" : watch ? "watch" : "action";
  const status = value === null ? "info" : onTarget ? "good" : watch ? "watch" : "action";
  return <article className={`metric-card metric-card--compact metric-card--${tone}`}><div className="metric-card__top"><span>{title}</span><i className="metric-status-pill">{t(status)}</i></div><strong className="metric-card__primary">{formatMetric(metricKey, value)}</strong><div className="compact-card-row"><span>{t("target")}</span><strong>{formatMetric(metricKey, target)}</strong></div><div className="compact-card-row"><span>{t("currentPeriod")}</span><strong>{value === null ? t("notAvailable") : t("active")}</strong></div></article>;
}

function PartTypeTrendTooltip({ active, payload, label, npiLabel, productionLabel, totalLabel, fpyLabel }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number | string }>; label?: string; npiLabel: string; productionLabel: string; totalLabel: string; fpyLabel: string }) {
  if (!active || !payload?.length) return null;
  const valueFor = (dataKey: string) => Number(payload.find((item) => item.dataKey === dataKey)?.value ?? 0);
  const npi = valueFor("npiQuantity");
  const production = valueFor("productionQuantity");
  const fpy = payload.find((item) => item.dataKey === "fpy")?.value;
  return <div style={chartTooltipStyle}><strong>{label}</strong><p>{npiLabel}: <b>{npi.toLocaleString()}</b></p><p>{productionLabel}: <b>{production.toLocaleString()}</b></p><p>{totalLabel}: <b>{(npi + production).toLocaleString()}</b></p>{fpy !== undefined && fpy !== null ? <p>{fpyLabel}: <b>{Number(fpy).toFixed(1)}%</b></p> : null}</div>;
}

export function ExecutiveOverview({ dataset, operation, filters, onFiltersChange, onOpenExplorer }: Props) {
  const { language, t } = useLanguage();
  const tr = (english: string, chinese: string) => language === "zh" ? chinese : english;
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("partType");
  const [processMetric, setProcessMetric] = useState<ProcessMetric>("quantity");
  const [customerExposureMetric, setCustomerExposureMetric] = useState<CustomerExposureMetric>("quantity");
  const [stageExposureMetric, setStageExposureMetric] = useState<StageExposureMetric>("quantity");
  const [level2Limit, setLevel2Limit] = useState<Level2Limit>(0);
  const [kpiOrder, setKpiOrder] = useState<KpiId[]>(readKpiOrder);
  const [draggedKpi, setDraggedKpi] = useState<KpiId | null>(null);
  const [kpiDropTarget, setKpiDropTarget] = useState<{ id: KpiId; position: DropPosition } | null>(null);
  const [analysisOrder, setAnalysisOrder] = useState<AnalysisId[]>(readAnalysisOrder);
  const [complaintAnalysisOrder, setComplaintAnalysisOrder] = useState<AnalysisId[]>(readComplaintAnalysisOrder);
  const [draggedAnalysis, setDraggedAnalysis] = useState<AnalysisId | null>(null);
  const [analysisDropTarget, setAnalysisDropTarget] = useState<{ id: AnalysisId; position: DropPosition } | null>(null);
  const range = getDateRange(filters);
  const inspections = useMemo(() => filterInspections(dataset.inspections, operation, filters, range), [dataset, operation, filters, range.start, range.end]);
  const complaints = useMemo(() => filterComplaints(dataset.complaints, operation, range, filters), [dataset, operation, filters, range.start, range.end]);
  // Overall cards always summarize every inspection stage while preserving the
  // selected operation, period, and the remaining quality filters.
  const overallInspections = useMemo(() => filterInspections(dataset.inspections, operation, { ...filters, stage: "all" }, range), [dataset, operation, filters, range.start, range.end]);
  const overallMetrics = useMemo(() => calculateMetrics(overallInspections, complaints), [overallInspections, complaints]);
  const partTypeKpis = useMemo(() => aggregatePartContributions(inspections, complaints).groups, [inspections, complaints]);
  const stageRows = useMemo(() => ({
    incoming: filterInspections(dataset.inspections, operation, { ...filters, stage: "incoming" }, range),
    ipqa: filterInspections(dataset.inspections, operation, { ...filters, stage: "in-process" }, range),
    oqa: filterInspections(dataset.inspections, operation, { ...filters, stage: "outgoing" }, range)
  }), [dataset, operation, filters, range.start, range.end]);
  const stageMetrics = useMemo(() => ({
    incoming: calculateMetrics(stageRows.incoming, []),
    ipqa: calculateMetrics(stageRows.ipqa, []),
    oqa: calculateMetrics(stageRows.oqa, [])
  }), [stageRows]);
  const complaintDeliveries = useMemo(() => {
    const scoped = dataset.deliveries.filter((row) => {
      const month = row.month;
      return month >= range.start.slice(0, 7) && month <= range.end.slice(0, 7) && (operation === "all" || row.operation === operation);
    });
    const hasCustomerRows = scoped.some((row) => row.customer?.trim());
    return scoped.filter((row) => filters.customer === "all" || !hasCustomerRows || row.customer?.trim() === filters.customer);
  }, [dataset.deliveries, operation, filters.customer, range.start, range.end]);
  const complaintMetrics = useMemo(() => calculateComplaintMetrics(complaints, complaintDeliveries), [complaints, complaintDeliveries]);
  const stageExposureBars = useMemo(() => [
    { key: "incoming", name: t("incoming"), quantity: stageMetrics.incoming.reworkQty + stageMetrics.incoming.scrapQty, cost: stageMetrics.incoming.rejectionCost },
    { key: "in-process", name: t("inProcess"), quantity: stageMetrics.ipqa.reworkQty + stageMetrics.ipqa.scrapQty, cost: stageMetrics.ipqa.rejectionCost },
    { key: "outgoing", name: t("outgoing"), quantity: stageMetrics.oqa.reworkQty + stageMetrics.oqa.scrapQty, cost: stageMetrics.oqa.rejectionCost },
    { key: "customer-complaint", name: t("customerComplaintStage"), quantity: complaintMetrics.affectedQty, cost: complaintMetrics.rejectionCost }
  ].sort((left, right) => right[stageExposureMetric] - left[stageExposureMetric]), [stageMetrics, complaintMetrics, stageExposureMetric, language]);
  const complaintProcesses = useMemo(() => groupComplaintRecords(complaints, "process").slice(0, 6), [complaints]);
  const complaintParts = useMemo(() => groupComplaintRecords(complaints, "partNumber").slice(0, 6), [complaints]);
  const customerExposureBars = useMemo(() => aggregateCustomerComplaintPerformance(complaints, complaintDeliveries, operation, range).map((item) => ({
    name: item.name,
    quantity: item.affectedQty,
    cost: item.externalFailureCost,
    complaintPpm: item.complaintPpm,
    deliveredQty: item.deliveredQty,
    cases: item.cases
  })).sort((left, right) => (right[customerExposureMetric] ?? -1) - (left[customerExposureMetric] ?? -1)), [complaints, complaintDeliveries, operation, range.start, range.end, customerExposureMetric]);
  const complaintView = filters.stage === "customer-complaint";
  const complaintRejectCategories = useMemo(() => groupComplaintRejectCategories(complaints), [complaints]);
  const target = dataset.targets[operation];

  const trendGranularity = getTrendGranularity(filters);
  const trendLabel = complaintView ? "month" : trendGranularity;
  const trendPeriodLabel = language === "zh"
    ? ({ day: "日", week: "周", month: "月份", quarter: "季度", year: "年份" }[trendLabel] ?? "月份")
    : trendLabel;
  const trendData = useMemo(() => filters.stage === "customer-complaint"
    ? aggregateComplaintTrendData(complaints, complaintDeliveries, operation, filters, range)
    : aggregateTrendData(inspections, complaints, filters, range), [inspections, complaints, complaintDeliveries, operation, filters, range.start, range.end]);
  const partTypeTrendData = useMemo(() => aggregatePartTypeTrendData(inspections, complaints, complaintDeliveries, filters, range), [inspections, complaints, complaintDeliveries, filters, range.start, range.end]);
  const localizedTrendData = useMemo(() => trendData.map((point) => ({ ...point, label: localizeTrendLabel(point.label, language) })), [trendData, language]);
  const localizedPartTypeTrendData = useMemo(() => partTypeTrendData.map((point) => ({ ...point, label: localizeTrendLabel(point.label, language) })), [partTypeTrendData, language]);
  const level2Matrix = useMemo(() => aggregateRejectCategoryLevel2Matrix(inspections, filters, range, level2Limit), [inspections, filters, range.start, range.end, level2Limit]);
  const complaintLevel2Matrix = useMemo(() => aggregateComplaintRejectCategoryLevel2Matrix(complaints, filters, range, level2Limit), [complaints, filters, range.start, range.end, level2Limit]);
  const workCenters = complaintView
    ? complaintProcesses.map((item) => ({ name: item.name, value: item.affectedQty, cases: item.cases, externalFailureCost: item.externalFailureCost }))
    : groupSum(inspections, (row) => row.workCenter, (row) => row.reworkQty + row.scrapQty).slice(0, 6);
  const parts = Array.from(new Set(inspections.map((row) => row.partNumber))).map((partNumber) => {
    const rows = inspections.filter((row) => row.partNumber === partNumber);
    const inspectedQty = rows.reduce((sum, row) => sum + row.inspectedQty, 0);
    const rejectedQty = rows.reduce((sum, row) => sum + row.reworkQty + row.scrapQty, 0);
    return { partNumber, inspectedQty, rejectedQty, qppm: inspectedQty ? (rejectedQty / inspectedQty) * 1_000_000 : null };
  }).sort((left, right) => (right.qppm ?? -1) - (left.qppm ?? -1)).slice(0, 6);
  const rejectCategories = useMemo(() => groupRejectCategories(inspections), [inspections]);
  const processes = groupSum(inspections, (row) => row.process, (row) => row.scrapQty + row.reworkQty).slice(0, 6);
  const processBars = useMemo(() => {
    const grouped = new Map<string, { name: string; quantity: number; cost: number }>();
    inspections.forEach((row) => {
      const current = grouped.get(row.process) ?? { name: row.process, quantity: 0, cost: 0 };
      current.quantity += row.scrapQty + row.reworkQty;
      current.cost += row.scrapCost + row.reworkCost;
      grouped.set(row.process, current);
    });
    return [...grouped.values()].sort((left, right) => right[processMetric] - left[processMetric]).slice(0, 6);
  }, [inspections, processMetric]);
  const trendYAxisDomain = useMemo(() => trendMetric === "partType" ? getPartTypeTrendYAxisDomain(partTypeTrendData) : getTrendYAxisDomain(trendData, trendMetric), [partTypeTrendData, trendData, trendMetric]);
  const trendRateYAxisDomain = useMemo(() => getTrendYAxisDomain(trendData, "acceptance"), [trendData]);
  const activeTrendData = trendMetric === "partType" ? partTypeTrendData : trendData;
  const activeLocalizedTrendData = trendMetric === "partType" ? localizedPartTypeTrendData : localizedTrendData;
  const activeTrendChartData = activeLocalizedTrendData as TrendChartPoint[];
  const trendXAxisInterval = getTrendXAxisInterval(activeTrendData.length);
  const trendPeriodWords = {
    day: { english: "Daily", chinese: "日", rollingChinese: "日" },
    week: { english: "Weekly", chinese: "每周", rollingChinese: "周" },
    month: { english: "Monthly", chinese: "月度", rollingChinese: "个月" },
    quarter: { english: "Quarterly", chinese: "季度", rollingChinese: "季度" },
    year: { english: "Yearly", chinese: "年度", rollingChinese: "年" }
  }[trendLabel] ?? { english: "Monthly", chinese: "月度", rollingChinese: "个月" };
  const trendSubtitle = filters.stage === "customer-complaint"
    ? trendMetric === "partType" ? t("partTypeComplaintTrendSubtitle") : t("complaintTrendSubtitle")
    : trendMetric === "acceptance"
      ? tr(`${trendPeriodWords.english} acceptance rate`, `${trendPeriodWords.chinese}合格率`)
      : trendMetric === "qppm"
        ? tr(`${trendPeriodWords.english} reject PPM with rolling 3-${trendLabel} QPPM`, `${trendPeriodWords.chinese}不良PPM与滚动3${trendPeriodWords.rollingChinese}质量PPM`)
        : t("partTypeTrendSubtitle");

  const openDrilldown = () => { if (!complaintView) onOpenExplorer(); };
  const drillToLevel2 = (level2: string) => { onFiltersChange({ ...filters, rejectCategoryLevel2: level2 }); openDrilldown(); };
  const filterToDefectCategory = (defect: string) => { onFiltersChange({ ...filters, rejectCategoryLevel1: defect as DashboardFilters["rejectCategoryLevel1"] }); };
  const drillToWorkCenter = (workCenter: string) => { onFiltersChange({ ...filters, workCenter }); openDrilldown(); };
  // Part table selections stay in Executive Overview so every KPI and analysis
  // card recalculates against the selected part in the same view.
  const drillToPart = (partNumber: string) => { onFiltersChange({ ...filters, partNumber }); };
  const drillToProcess = (process: string) => { onFiltersChange({ ...filters, process }); openDrilldown(); };
  const filterToProcess = (process: string) => { onFiltersChange({ ...filters, process }); };
  const drillToCustomer = (customer: string) => { onFiltersChange({ ...filters, customer }); openDrilldown(); };
  const filterToStage = (stage: DashboardFilters["stage"]) => { onFiltersChange(cascadeStageFilters(dataset.inspections, operation, filters, stage)); };
  const filterToTrendPoint = (key: string) => {
    const granularity = complaintView ? "month" : trendGranularity;
    if (granularity === "day") onFiltersChange({ ...filters, periodMode: "day-range", dayFrom: key, dayTo: key });
    else if (granularity === "week") onFiltersChange({ ...filters, periodMode: "week-range", weekFrom: key, weekTo: key });
    else if (granularity === "month") onFiltersChange({ ...filters, periodMode: "month-range", monthFrom: key, monthTo: key });
    else if (granularity === "quarter") onFiltersChange({ ...filters, periodMode: "quarter-range", quarterFrom: key as DashboardFilters["quarterFrom"], quarterTo: key as DashboardFilters["quarterTo"] });
    else onFiltersChange({ ...filters, periodMode: "year-range", yearFrom: Number(key), yearTo: Number(key) });
  };
  const filterToTrendIndex = (index: number | undefined) => {
    const point = index === undefined ? undefined : activeTrendData[index];
    if (point?.key) filterToTrendPoint(point.key);
  };
  const resetTrendPeriod = () => {
    setTrendMetric("partType");
    onFiltersChange({ ...filters, periodMode: defaultFilters.periodMode, preset: defaultFilters.preset, dayFrom: defaultFilters.dayFrom, dayTo: defaultFilters.dayTo, monthFrom: defaultFilters.monthFrom, monthTo: defaultFilters.monthTo, yearFrom: defaultFilters.yearFrom, yearTo: defaultFilters.yearTo, quarterFrom: defaultFilters.quarterFrom, quarterTo: defaultFilters.quarterTo, weekFrom: defaultFilters.weekFrom, weekTo: defaultFilters.weekTo });
  };
  const renderTrendDot = (props: { cx?: number; cy?: number; payload?: { key?: string } }) => <circle cx={props.cx} cy={props.cy} r={3} fill="#ffffff" stroke="#167d67" strokeWidth={2.5} style={{ cursor: "pointer" }} onClick={() => { if (props.payload?.key) filterToTrendPoint(props.payload.key); }} />;
  const drillToAllProcesses = () => { onFiltersChange({ ...filters, process: "all" }); onOpenExplorer(); };
  const moveKpi = (targetKpi: KpiId, position: DropPosition = "before") => {
    if (!draggedKpi || draggedKpi === targetKpi) return;
    setKpiOrder((current) => {
      const next = reorderVisibleItems(current, visibleKpiOrder, draggedKpi, targetKpi, position);
      localStorage.setItem(KPI_LAYOUT_KEY, JSON.stringify(next));
      return next;
    });
    setDraggedKpi(null);
    setKpiDropTarget(null);
  };
  const moveAnalysis = (targetId: AnalysisId, position: DropPosition = "before") => {
    if (!draggedAnalysis || draggedAnalysis === targetId) return;
    if (complaintView) {
      setComplaintAnalysisOrder((current) => {
        const next = reorderVisibleItems(current, current, draggedAnalysis, targetId, position);
        localStorage.setItem(COMPLAINT_ANALYSIS_LAYOUT_KEY, JSON.stringify(next));
        return next;
      });
    } else {
      setAnalysisOrder((current) => {
        const next = reorderVisibleItems(current, visibleAnalysisOrder, draggedAnalysis, targetId, position);
        localStorage.setItem(ANALYSIS_LAYOUT_KEY, JSON.stringify(next));
        return next;
      });
    }
    setDraggedAnalysis(null);
    setAnalysisDropTarget(null);
  };
  const getDropPosition = (event: DragEvent<HTMLElement>): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  };
  const visibleKpiOrder = filters.stage === "all"
    ? kpiOrder
    : kpiOrder.filter((id) => id === "overallQuality" || id === "overallCopq" || id === "overallScrap"
      || (filters.stage === "customer-complaint" && id === "complaint")
      || (filters.stage === "incoming" && id === "incoming")
      || (filters.stage === "in-process" && id === "ipqa")
      || (filters.stage === "outgoing" && id === "oqa"));
  const aggregateView = filters.stage === "all";
  const topKpiOrder = aggregateView
    ? visibleKpiOrder.filter((id) => id === "overallQuality" || id === "overallCopq" || id === "overallScrap" || id === "complaint")
    : visibleKpiOrder;
  // Stage exposure is the aggregate-view selector. Selected inspection stages
  // keep the shared analysis cards and hide only inapplicable comparisons.
  const visibleAnalysisOrder = complaintView
    ? complaintAnalysisOrder
    : filters.stage === "incoming"
      ? analysisOrder.filter((id) => id !== "complaints" && id !== "internalCost" && id !== "workCenters")
      : filters.stage === "all"
        ? analysisOrder.filter((id) => id !== "internalCost")
        : analysisOrder.filter((id) => id !== "complaints");
  const renderMetricCard = (id: KpiId) => {
    switch (id) {
      case "incoming": return <CompactMetricCard title={t("incomingKpi")} fpy={stageMetrics.incoming.fpy} targetFpy={target.fpy} rejectPpm={stageMetrics.incoming.rejectPpm} targetRejectPpm={target.rejectPpm} rejectionCost={stageMetrics.incoming.rejectionCost} />;
      case "ipqa": return <CompactMetricCard title={t("ipqaKpi")} fpy={stageMetrics.ipqa.fpy} targetFpy={target.fpy} rejectPpm={stageMetrics.ipqa.rejectPpm} targetRejectPpm={target.rejectPpm} rejectionCost={stageMetrics.ipqa.rejectionCost} />;
      case "oqa": return <CompactMetricCard title={t("oqaKpi")} fpy={stageMetrics.oqa.fpy} targetFpy={target.fpy} rejectPpm={stageMetrics.oqa.rejectPpm} targetRejectPpm={target.rejectPpm} rejectionCost={stageMetrics.oqa.rejectionCost} />;
      case "complaint": return <ComplaintMetricCard title={t("customerComplaintKpi")} metrics={complaintMetrics} targetFpy={target.complaintFpy} targetRejectPpm={target.complaintRejectPpm} />;
      case "overallQuality": return <CompactMetricCard title={t("overallQualityKpi")} fpy={overallMetrics.fpy} targetFpy={target.fpy} rejectPpm={overallMetrics.rejectPpm} targetRejectPpm={target.rejectPpm} rejectionCost={overallMetrics.rejectionCost} />;
      case "overallCopq": return <OverallSingleMetricCard title={aggregateView ? t("costOfQualityKpi") : t("overallCopqKpi")} metricKey="copq" value={overallMetrics.copq} target={target.copq} lowerIsBetter />;
      case "overallScrap": return <OverallSingleMetricCard title={t("overallScrapKpi")} metricKey="scrapRate" value={overallMetrics.scrapRate} target={target.scrapRate} lowerIsBetter />;
    }
  };
  const renderRejectCategoryLevel1 = () => <ChartWidget title={t("rejectCategoryLevel1")} subtitle={t("rejectCategoryLevel1Subtitle")} action={<><span className="chart-note">{t("top")} 6</span><button className="text-button" type="button" onClick={() => onFiltersChange({ ...filters, rejectCategoryLevel1: "all" })} disabled={filters.rejectCategoryLevel1 === "all"}>{t("reset")}</button></>}><div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={rejectCategories} layout="vertical" margin={{ left: 18, right: 14 }}><CartesianGrid stroke="#e6ebef" horizontal={false} /><XAxis type="number" name={t("rejectedUnits")} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} /><YAxis dataKey="name" type="category" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#52616d" }} /><Tooltip contentStyle={chartTooltipStyle} /><Bar dataKey="value" name={t("rejectedUnits")} fill="#d8683e" radius={[0, 4, 4, 0]} onClick={(entry) => filterToDefectCategory(String(entry.name))}>{rejectCategories.map((item) => <Cell key={item.name} cursor="pointer" />)}</Bar></BarChart></ResponsiveContainer></div></ChartWidget>;
  const renderComplaintRejectCategoryLevel1 = () => <ChartWidget title={t("complaintRejectCategoryLevel1")} subtitle={t("complaintRejectCategoryLevel1Subtitle")} action={<><span className="chart-note">{t("top")} 6</span><button className="text-button" type="button" onClick={() => onFiltersChange({ ...filters, rejectCategoryLevel1: "all" })} disabled={filters.rejectCategoryLevel1 === "all"}>{t("reset")}</button></>}><div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={complaintRejectCategories} layout="vertical" margin={{ left: 18, right: 14 }}><CartesianGrid stroke="#e6ebef" horizontal={false} /><XAxis type="number" name={t("affectedQty")} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} /><YAxis dataKey="name" type="category" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#52616d" }} /><Tooltip contentStyle={chartTooltipStyle} /><Bar dataKey="value" name={t("affectedQty")} fill="#d8683e" radius={[0, 4, 4, 0]} onClick={(entry) => filterToDefectCategory(String(entry.name))}>{complaintRejectCategories.map((item) => <Cell key={item.name} cursor="pointer" />)}</Bar></BarChart></ResponsiveContainer></div></ChartWidget>;
  const renderAnalysisCard = (id: AnalysisId) => {
    switch (id) {
      case "defects": return complaintView
        ? <ChartWidget title={t("complaintRejectCategoryLevel2")} subtitle={t("complaintRejectCategoryLevel2MatrixSubtitle")} action={<><label className="trend-select"><span>{t("show")}</span><select aria-label={t("complaintRejectCategoryLevel2")} value={level2Limit} onChange={(event) => setLevel2Limit(Number(event.target.value) as Level2Limit)}><option value={5}>{t("top")} 5</option><option value={0}>{t("allLevel2Reasons")}</option></select></label><span className="chart-note">{complaintLevel2Matrix.granularity}</span>{filters.rejectCategoryLevel2 !== "all" ? <button className="text-button" type="button" onClick={() => onFiltersChange({ ...filters, rejectCategoryLevel2: "all" })}>{t("clearLevel2")}</button> : null}</>} className="chart-card--wide" resizable><Level2MatrixChart data={complaintLevel2Matrix} selectedKey={filters.rejectCategoryLevel2} quantityLabel={t("affectedQty")} periodLabel={t("period")} onSelect={drillToLevel2} /></ChartWidget>
        : <ChartWidget title={t("rejectCategoryLevel2")} subtitle={t("rejectCategoryLevel2MatrixSubtitle")} action={<><label className="trend-select"><span>{t("show")}</span><select aria-label={t("rejectCategoryLevel2")} value={level2Limit} onChange={(event) => setLevel2Limit(Number(event.target.value) as Level2Limit)}><option value={5}>{t("top")} 5</option><option value={0}>{t("allLevel2Reasons")}</option></select></label><span className="chart-note">{level2Matrix.granularity}</span></>} className="chart-card--wide" resizable><Level2MatrixChart data={level2Matrix} selectedKey={filters.rejectCategoryLevel2} quantityLabel={t("rejectedUnits")} periodLabel={t("period")} onSelect={drillToLevel2} /></ChartWidget>;
      case "cost": return complaintView
        ? <ChartWidget title={t("customerComplaintCostTitle")} subtitle={t("complaintCostSubtitle") + ` ${trendPeriodLabel}`}><div className="chart-height chart-height--short"><ResponsiveContainer width="100%" height="100%"><BarChart data={localizedTrendData}><CartesianGrid stroke="#e6ebef" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} tickFormatter={(value) => `RM${Math.round(value / 1000)}k`} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value) => currency.format(Number(value))} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="externalScrapCost" name={t("externalScrapCost")} stackId="external-cost" fill="#d8683e" /><Bar dataKey="externalReworkCost" name={t("externalReworkCost")} stackId="external-cost" fill="#d99b45" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartWidget>
        : filters.stage === "incoming" ? renderRejectCategoryLevel1() : <ChartWidget title={t("processQuality")} subtitle={t("processSubtitle")} action={<><label className="trend-select"><span>{t("show")}</span><select aria-label={t("processMetric")} value={processMetric} onChange={(event) => setProcessMetric(event.target.value as ProcessMetric)}><option value="quantity">{t("rejectedUnits")}</option><option value="cost">{t("rejectionCost")}</option></select></label><button className="text-button" type="button" onClick={() => onFiltersChange({ ...filters, process: "all" })} disabled={filters.process === "all"}>{t("reset")}</button></>}><div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={processBars} layout="vertical" margin={{ left: 18, right: 14 }}><CartesianGrid stroke="#e6ebef" horizontal={false} /><XAxis type="number" name={processMetric === "cost" ? t("rejectionCost") : t("rejectedUnits")} tickFormatter={processMetric === "cost" ? (value) => `RM${Math.round(Number(value) / 1000)}k` : undefined} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} /><YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#52616d" }} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value) => processMetric === "cost" ? currency.format(Number(value)) : Number(value).toLocaleString()} /><Bar dataKey={processMetric} name={processMetric === "cost" ? t("rejectionCost") : t("rejectedUnits")} fill="#d8683e" radius={[0, 4, 4, 0]} onClick={(entry) => filterToProcess(String(entry.name))}>{processBars.map((item) => <Cell key={item.name} cursor="pointer" />)}</Bar></BarChart></ResponsiveContainer></div></ChartWidget>;
      case "internalCost": return <ChartWidget title={t("internalCostTitle")} subtitle={`${t("internalCostSubtitle")} ${trendPeriodLabel}`}><div className="chart-height chart-height--short"><ResponsiveContainer width="100%" height="100%"><BarChart data={localizedTrendData}><CartesianGrid stroke="#e6ebef" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} tickFormatter={(value) => `RM${Math.round(Number(value) / 1000)}k`} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value) => currency.format(Number(value))} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="scrapCost" name={t("scrapCost")} stackId="internal-cost" fill="#d8683e" /><Bar dataKey="reworkCost" name={t("reworkCost")} stackId="internal-cost" fill="#d99b45" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartWidget>;
      case "workCenters": return complaintView
        ? <ChartWidget title={t("processAffected")} subtitle={t("complaintProcessSubtitle")}><div className="ranking-list">{complaintProcesses.map((item, index) => <button key={item.name} type="button" onClick={() => drillToProcess(item.name)}><span><b>{index + 1}</b>{item.name}<small>{item.cases} {t("complaintCases")} · {currency.format(item.externalFailureCost)}</small></span><i><em style={{ width: `${Math.max(8, (item.affectedQty / (complaintProcesses[0]?.affectedQty || 1)) * 100)}%` }} /></i><strong>{item.affectedQty}</strong></button>)}</div></ChartWidget>
        : <ChartWidget title={t("workCenterComparison")} subtitle={t("workCenterSubtitle")}><div className="ranking-list">{workCenters.map((item, index) => <button key={item.name} type="button" onClick={() => drillToWorkCenter(item.name)}><span><b>{index + 1}</b>{item.name}</span><i><em style={{ width: `${Math.max(8, (item.value / (workCenters[0]?.value || 1)) * 100)}%` }} /></i><strong>{item.value}</strong></button>)}</div></ChartWidget>;
      case "parts": return complaintView
        ? <ChartWidget title={t("topComplaintParts")} subtitle={t("complaintPartsSubtitle")} action={<span className="chart-note">{t("top")} 6</span>}><div className="parts-monitor"><div className="parts-monitor__head"><span>{t("part")}</span><span>{t("affectedQty")}</span><span>{t("complaintCases")}</span><span>{t("externalFailure")}</span></div>{complaintParts.map((item, index) => <button key={item.name} type="button" onClick={() => drillToPart(item.name)}><strong><b>{index + 1}</b>{item.name}</strong><span>{item.affectedQty.toLocaleString()}</span><span>{item.cases}</span><em>{currency.format(item.externalFailureCost)}</em></button>)}</div></ChartWidget>
        : <ChartWidget title={t("topProblemParts")} subtitle={t("partsSubtitle")} action={<span className="chart-note">{t("top")} 6</span>}><div className="parts-monitor"><div className="parts-monitor__head"><span>{t("part")}</span><span>{t("inspectQty")}</span><span>{t("rejectQty")}</span><span>{t("qppm")}</span></div>{parts.map((item, index) => <button key={item.partNumber} type="button" onClick={() => drillToPart(item.partNumber)}><strong><b>{index + 1}</b>{item.partNumber}</strong><span>{item.inspectedQty.toLocaleString()}</span><span>{item.rejectedQty.toLocaleString()}</span><em>{item.qppm === null ? "—" : Math.round(item.qppm).toLocaleString()}</em></button>)}</div></ChartWidget>;
      case "suppliers": { if (complaintView) return renderComplaintRejectCategoryLevel1(); if (filters.stage !== "incoming") return renderRejectCategoryLevel1(); const supplierRows = groupSum(inspections, (row) => row.supplier, (row) => row.scrapQty + row.reworkQty).slice(0, 6); return <ChartWidget title={t("supplierQuality")} subtitle={t("supplierSubtitle")} action={<button className="text-button" type="button" onClick={() => onFiltersChange({ ...filters, supplier: "all" })} disabled={filters.supplier === "all"}>{t("reset")}</button>}><div className="ranking-list">{supplierRows.map((item, index) => <button type="button" key={item.name} onClick={() => onFiltersChange({ ...filters, supplier: item.name })}><span><b>{index + 1}</b>{item.name}</span><i><em style={{ width: `${Math.max(8, (item.value / (supplierRows[0]?.value || 1)) * 100)}%` }} /></i><strong>{item.value}</strong></button>)}</div></ChartWidget>; }
      case "complaints": return complaintView
        ? <ChartWidget title={t("customerExposure")} subtitle={t("customerExposureSubtitle")} action={<><label className="trend-select"><span>{t("show")}</span><select aria-label="Customer exposure metric" value={customerExposureMetric} onChange={(event) => setCustomerExposureMetric(event.target.value as CustomerExposureMetric)}><option value="quantity">{t("affectedQty")}</option><option value="cost">{t("externalFailure")}</option><option value="complaintPpm">{t("complaintPpm")}</option></select></label><button className="text-button" type="button" onClick={() => onFiltersChange({ ...filters, customer: "all" })} disabled={filters.customer === "all"}>{t("reset")}</button></>}><div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={customerExposureBars} layout="vertical" margin={{ left: 18, right: 14 }}><CartesianGrid stroke="#e6ebef" horizontal={false} /><XAxis type="number" name={customerExposureMetric === "cost" ? t("externalFailure") : customerExposureMetric === "complaintPpm" ? t("complaintPpm") : t("affectedQty")} tickFormatter={customerExposureMetric === "cost" ? (value) => `RM${Math.round(Number(value) / 1000)}k` : undefined} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} /><YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#52616d" }} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value) => customerExposureMetric === "cost" ? currency.format(Number(value)) : customerExposureMetric === "complaintPpm" ? (value === null ? t("notAvailable") : `${Number(value).toLocaleString()} PPM`) : Number(value).toLocaleString()} /><Bar dataKey={customerExposureMetric} name={customerExposureMetric === "cost" ? t("externalFailure") : customerExposureMetric === "complaintPpm" ? t("complaintPpm") : t("affectedQty")} fill={customerExposureMetric === "complaintPpm" ? "#167d67" : "#d8683e"} radius={[0, 4, 4, 0]} onClick={(entry) => drillToCustomer(String(entry.name))}>{customerExposureBars.map((item) => <Cell key={item.name} cursor="pointer" />)}</Bar></BarChart></ResponsiveContainer></div></ChartWidget>
        : filters.stage === "all"
          ? <ChartWidget title={t("stageExposure")} subtitle={t("stageExposureSubtitle")} action={<label className="trend-select"><span>{t("show")}</span><select aria-label="Stage exposure metric" value={stageExposureMetric} onChange={(event) => setStageExposureMetric(event.target.value as StageExposureMetric)}><option value="quantity">{t("quantity")}</option><option value="cost">{t("rejectionCost")}</option></select></label>}><div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={stageExposureBars} layout="vertical" margin={{ left: 18, right: 14 }}><CartesianGrid stroke="#e6ebef" horizontal={false} /><XAxis type="number" name={stageExposureMetric === "cost" ? t("rejectionCost") : t("quantity")} tickFormatter={stageExposureMetric === "cost" ? (value) => `RM${Math.round(Number(value) / 1000)}k` : undefined} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#74808b" }} /><YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#52616d" }} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value) => stageExposureMetric === "cost" ? currency.format(Number(value)) : Number(value).toLocaleString()} /><Bar dataKey={stageExposureMetric} name={stageExposureMetric === "cost" ? t("rejectionCost") : t("quantity")} fill="#d8683e" radius={[0, 4, 4, 0]} onClick={(entry) => filterToStage(String(entry.key) as DashboardFilters["stage"])}>{stageExposureBars.map((item) => <Cell key={item.key} cursor="pointer" />)}</Bar></BarChart></ResponsiveContainer></div></ChartWidget>
          : <ChartWidget title={t("customerComplaintTitle")} subtitle={t("complaintSubtitle")} action={<span className="chart-note">{complaints.filter((row) => row.status === "Open").length} {t("open")}</span>}><div className="complaint-list">{[...complaints].sort((a, b) => b.complaintDate.localeCompare(a.complaintDate)).slice(0, 5).map((row) => <div key={row.id}><span className={`severity severity--${row.severity.toLowerCase()}`}>{tr(row.severity, row.severity === "Critical" ? "严重" : row.severity === "Major" ? "主要" : "轻微")}</span><p><strong>{row.customer}</strong><small>{row.partNumber} · {row.defectCategory}</small></p><p className="complaint-cost"><strong>{currency.format(row.externalFailureCost)}</strong><small>{tr(row.status, row.status === "Open" ? "未关闭" : "已关闭")}</small></p></div>)}</div></ChartWidget>;
    }
  };

  return <div className="page-stack">
    <section className="page-header"><div><div className="eyebrow">{t("executiveReview")}</div><h1>{operationLabel(operation, language)}</h1><p>{t("performanceSubtitle")} · {range.start} to {range.end}</p></div><button className="primary-button" type="button" onClick={onOpenExplorer}>{t("openQualityExplorer")} <ArrowRight size={15} /></button></section>
    <FilterPanel rows={dataset.inspections} operation={operation} filters={filters} onChange={onFiltersChange} customers={Array.from(new Set(dataset.complaints.map((row) => row.customer)))} complaints={dataset.complaints} compact />
    <><div className="metric-toolbar"><strong>{t("keyPerformance")}</strong></div><section className={`metric-grid metric-grid--count-${topKpiOrder.length}${aggregateView ? " metric-grid--top" : ""}`}>{topKpiOrder.map((id) => <div className={`metric-drag-item${kpiDropTarget?.id === id ? " is-drop-target" : ""}`} data-kpi={id} data-drop-position={kpiDropTarget?.id === id ? kpiDropTarget.position : undefined} key={id} draggable aria-grabbed={draggedKpi === id} aria-label={`Reorder ${kpiLabels[id]} KPI`} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); setDraggedKpi(id); }} onDragOver={(event) => { event.preventDefault(); if (draggedKpi && draggedKpi !== id) setKpiDropTarget({ id, position: getDropPosition(event) }); }} onDrop={(event) => { event.preventDefault(); moveKpi(id, getDropPosition(event)); }} onDragEnd={() => { setDraggedKpi(null); setKpiDropTarget(null); }}>{renderMetricCard(id)}</div>)}</section></>

    {aggregateView ? <><div className="metric-toolbar metric-toolbar--secondary"><strong>{t("inspectionAndLifecycle")}</strong></div><section className="metric-summary-grid" aria-label={t("inspectionAndLifecycle")}><InspectionStagesSummaryCard metrics={stageMetrics} targetFpy={target.fpy} targetRejectPpm={target.rejectPpm} /><PartLifecycleSummaryCard groups={partTypeKpis} combinedFpy={overallMetrics.fpy} combinedRejectPpm={overallMetrics.rejectPpm} targetFpy={target.fpy} targetRejectPpm={target.rejectPpm} /></section></> : <section className="part-type-kpi-grid" aria-label={t("partContributionMonitoring")}>{partTypeKpis.map((group) => <PartTypeMetricCard key={group.partType} title={group.partType === "NPI" ? t("npiParts") : t("productionParts")} group={group} targetFpy={target.fpy} targetRejectPpm={target.rejectPpm} />)}</section>}

    <div className="analysis-toolbar"><strong>{t("qualityAnalysis")}</strong></div><section className="dashboard-grid dashboard-grid--executive">
      <ChartWidget title={t("qualityPerformanceTrend")} subtitle={trendSubtitle} action={<><label className="trend-select"><span>{t("trendShow")}</span><select aria-label="Trend metric" value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as TrendMetric)}><option value="partType">{t("npiProductionTrend")}</option><option value="acceptance">{t("acceptanceRate")}</option><option value="qppm">{t("rejectPpm")} (QPPM)</option></select></label><button className="text-button" type="button" onClick={resetTrendPeriod}>{t("reset")}</button></>} className="chart-card--wide">
        <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={activeTrendChartData} margin={{ top: 10, right: trendMetric === "partType" ? 24 : 12, left: 0, bottom: 0 }} onClick={(state) => { const chartState = state as unknown as { activeTooltipIndex?: number; activePayload?: Array<{ payload?: { key?: string } }> }; const point = chartState?.activePayload?.[0]?.payload; if (point?.key) filterToTrendPoint(point.key); else if (typeof chartState?.activeTooltipIndex === "number") filterToTrendIndex(chartState.activeTooltipIndex); }}><CartesianGrid stroke="#e6ebef" vertical={false} /><XAxis dataKey="label" interval={trendXAxisInterval} minTickGap={activeTrendData.length > 14 ? 18 : 8} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#74808b" }} />{trendMetric === "acceptance" ? <><YAxis domain={trendYAxisDomain} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#74808b" }} unit="%" /><Tooltip contentStyle={chartTooltipStyle} /><Line type="monotone" dataKey="fpy" name={`${t("acceptanceRate")} %`} stroke="#167d67" strokeWidth={2.5} dot={renderTrendDot} onClick={(_, index) => filterToTrendIndex(typeof index === "number" ? index : undefined)} /></> : trendMetric === "qppm" ? <><YAxis domain={trendYAxisDomain} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#74808b" }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} /><Tooltip contentStyle={chartTooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="rejectPpm" name={`${t("rejectPpm")} (${trendLabel})`} fill="#d99b45" radius={[3, 3, 0, 0]} barSize={22} onClick={(_, index) => filterToTrendIndex(typeof index === "number" ? index : undefined)} /><Line dataKey="rollingQppm" type="monotone" name={tr(`Rolling 3-${trendLabel} QPPM`, `滚动3${trendPeriodWords.rollingChinese}质量PPM`)} stroke="#167d67" strokeWidth={2.5} dot={renderTrendDot} onClick={(_, index) => filterToTrendIndex(typeof index === "number" ? index : undefined)} /></> : <><YAxis yAxisId="quantity" domain={trendYAxisDomain} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#74808b" }} tickFormatter={(value) => Number(value).toLocaleString()} /><YAxis yAxisId="rate" orientation="right" domain={trendRateYAxisDomain} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#244b5a" }} unit="%" /><Tooltip content={<PartTypeTrendTooltip npiLabel={t("npiRejectedUnits")} productionLabel={t("productionRejectedUnits")} totalLabel={t("totalQuantity")} fpyLabel={t("acceptanceRate")} />} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar yAxisId="quantity" dataKey="npiQuantity" name={t("npiRejectedUnits")} fill="#d99b45" stackId="part-type" barSize={22} onClick={(_, index) => filterToTrendIndex(typeof index === "number" ? index : undefined)} /><Bar yAxisId="quantity" dataKey="productionQuantity" name={t("productionRejectedUnits")} fill="#167d67" stackId="part-type" radius={[3, 3, 0, 0]} barSize={22} onClick={(_, index) => filterToTrendIndex(typeof index === "number" ? index : undefined)} /><Line yAxisId="rate" type="monotone" dataKey="fpy" name={`${t("acceptanceRate")} %`} stroke="#244b5a" strokeWidth={2.5} dot={renderTrendDot} onClick={(_, index) => filterToTrendIndex(typeof index === "number" ? index : undefined)} /></>}</ComposedChart></ResponsiveContainer></div>
      </ChartWidget>
      {visibleAnalysisOrder.map((id) => <div className={`analysis-drag-item${id === "defects" ? " analysis-drag-item--wide" : ""}${analysisDropTarget?.id === id ? " is-drop-target" : ""}`} data-drop-position={analysisDropTarget?.id === id ? analysisDropTarget.position : undefined} key={id} draggable aria-grabbed={draggedAnalysis === id} aria-label={`Reorder ${id} analysis`} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); setDraggedAnalysis(id); }} onDragOver={(event) => { event.preventDefault(); if (draggedAnalysis && draggedAnalysis !== id) setAnalysisDropTarget({ id, position: getDropPosition(event) }); }} onDrop={(event) => { event.preventDefault(); moveAnalysis(id, getDropPosition(event)); }} onDragEnd={() => { setDraggedAnalysis(null); setAnalysisDropTarget(null); }}>{renderAnalysisCard(id)}</div>)}
    </section>
  </div>;
}
