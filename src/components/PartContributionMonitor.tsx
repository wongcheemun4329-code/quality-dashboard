import { useMemo, useRef, useState, type PointerEvent } from "react";
import { ArrowUpRight, Grip } from "lucide-react";
import { aggregatePartContributions, type ComplaintRecord, type InspectionRecord, type PartContributionMetric } from "../data/qualityData";
import { useLanguage } from "../i18n";

type Props = {
  inspections: InspectionRecord[];
  complaints: ComplaintRecord[];
  onPartSelect: (partNumber: string) => void;
};

const currency = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });

const metricKeys: Record<PartContributionMetric, { value: "rejectedQty" | "inspectedQty" | "failureCost"; share: "rejectedShare" | "inspectedShare" | "failureCostShare" }> = {
  rejectedQty: { value: "rejectedQty", share: "rejectedShare" },
  inspectedQty: { value: "inspectedQty", share: "inspectedShare" },
  failureCost: { value: "failureCost", share: "failureCostShare" }
};

export function PartContributionMonitor({ inspections, complaints, onPartSelect }: Props) {
  const { t } = useLanguage();
  const [metric, setMetric] = useState<PartContributionMetric>("rejectedQty");
  const [cardSizes, setCardSizes] = useState<Partial<Record<"NPI" | "Production", { width: number; height: number }>>>({});
  const resizeDrag = useRef<{ partType: "NPI" | "Production"; axis: "x" | "y" | "both"; x: number; y: number; width: number; height: number } | null>(null);
  const analysis = useMemo(() => aggregatePartContributions(inspections, complaints), [inspections, complaints]);
  const metricConfig = metricKeys[metric];
  const hasData = analysis.parts.length > 0;
  const rankedParts = [...analysis.parts].sort((left, right) => right[metricConfig.value] - left[metricConfig.value] || right.rejectedQty - left.rejectedQty).slice(0, 8);
  const maxMetricValue = rankedParts[0]?.[metricConfig.value] ?? 1;
  const groupLabel = (partType: "NPI" | "Production") => partType === "NPI" ? t("npiParts") : t("productionParts");
  const startResize = (partType: "NPI" | "Production", axis: "x" | "y" | "both", event: PointerEvent<HTMLButtonElement>) => {
    const card = event.currentTarget.closest(".part-contribution-group");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    resizeDrag.current = { partType, axis, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeDrag.current) return;
    const { partType, axis, x, y, width, height } = resizeDrag.current;
    setCardSizes((current) => ({ ...current, [partType]: {
      width: axis === "y" ? width : Math.min(900, Math.max(240, width + event.clientX - x)),
      height: axis === "x" ? height : Math.min(520, Math.max(142, height + event.clientY - y))
    } }));
  };
  const endResize = () => { resizeDrag.current = null; };

  return <section className="part-contribution-card" aria-label={t("partContributionMonitoring")}>
    <div className="part-contribution-card__header">
      <div><h2>{t("partContributionMonitoring")}</h2><p>{t("partContributionSubtitle")}</p></div>
      <div className="part-contribution-card__metric" role="group" aria-label={t("contributionSubtitle")}>
        <button type="button" className={metric === "rejectedQty" ? "active" : ""} onClick={() => setMetric("rejectedQty")}>{t("contributionRejected")}</button>
        <button type="button" className={metric === "inspectedQty" ? "active" : ""} onClick={() => setMetric("inspectedQty")}>{t("contributionInspected")}</button>
        <button type="button" className={metric === "failureCost" ? "active" : ""} onClick={() => setMetric("failureCost")}>{t("contributionFailureCost")}</button>
      </div>
    </div>
    {!hasData ? <div className="part-contribution-card__empty">{t("notAvailable")}</div> : <>
      <div className="part-contribution-groups">
        {analysis.groups.map((group) => <article className={`metric-card metric-card--compact part-contribution-group part-contribution-group--${group.partType.toLowerCase()}`} style={cardSizes[group.partType] ? cardSizes[group.partType] : undefined} key={group.partType}>
          <div className="metric-card__top"><span>{groupLabel(group.partType)}</span><i className="metric-status-pill part-contribution-share" aria-label={`${groupLabel(group.partType)} ${group[metricConfig.share].toFixed(1)}%`}>{group[metricConfig.share].toFixed(1)}%</i></div>
          <strong className="metric-card__primary">{group.rejectedQty.toLocaleString()}<small>{t("contributionRejected")}</small></strong>
          <div className="compact-card-row"><span>{t("contributionInspected")}</span><strong>{group.inspectedQty.toLocaleString()}</strong></div>
          <div className="compact-card-row"><span>{t("contributionFailureCost")}</span><strong>{currency.format(group.failureCost)}</strong></div>
          <div className="compact-card-row"><span>{t("rejectionRate")}</span><strong>{group.rejectionRate === null ? "—" : `${group.rejectionRate.toFixed(1)}%`}</strong></div>
          <div className="compact-card-row"><span>{t("complaintExposure")}</span><strong>{group.complaintAffectedQty.toLocaleString()} · {group.complaintCases} {t("complaintCases")}</strong></div>
          <button type="button" className="part-contribution-group__resize-handle part-contribution-group__resize-handle--right" aria-label={`${groupLabel(group.partType)} resize width`} title={`${groupLabel(group.partType)} resize width`} onPointerDown={(event) => startResize(group.partType, "x", event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} />
          <button type="button" className="part-contribution-group__resize-handle part-contribution-group__resize-handle--bottom" aria-label={`${groupLabel(group.partType)} resize height`} title={`${groupLabel(group.partType)} resize height`} onPointerDown={(event) => startResize(group.partType, "y", event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} />
          <button type="button" className="part-contribution-group__resize-handle part-contribution-group__resize-handle--corner" aria-label={`${groupLabel(group.partType)} resize width and height`} title={`${groupLabel(group.partType)} resize width and height`} onPointerDown={(event) => startResize(group.partType, "both", event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}><Grip size={13} aria-hidden="true" /></button>
        </article>)}
      </div>
      <div className="part-contribution-table-wrap">
        <div className="part-contribution-table-head"><strong>{t("topPartContributors")}</strong><span>{t("partContributionTableSubtitle")}</span></div>
        <div className="part-contribution-table" role="table" aria-label={t("topPartContributors")}>
          <div className="part-contribution-row part-contribution-row--head" role="row"><span>#</span><span>{t("part")}</span><span>{t("partType")}</span><span>{t("inspectQty")}</span><span>{t("rejectQty")}</span><span>{t("rejectionRate")}</span><span>{t("contribution")}</span><span>{t("failureCost")}</span></div>
          {rankedParts.map((part, index) => <button type="button" className="part-contribution-row" key={`${part.partType}-${part.partNumber}`} onClick={() => onPartSelect(part.partNumber)} aria-label={`${part.partNumber} ${groupLabel(part.partType)}`}>
            <span>{index + 1}</span>
            <span className="part-contribution-row__part"><strong>{part.partNumber}</strong><small>{part.partName}</small></span>
            <span><em className={`part-type-tag part-type-tag--${part.partType.toLowerCase()}`}>{part.partType === "NPI" ? t("npi") : t("production")}</em></span>
            <span>{part.inspectedQty.toLocaleString()}</span>
            <span>{part.rejectedQty.toLocaleString()}</span>
            <span className={part.rejectionRate !== null && part.rejectionRate >= 6 ? "part-contribution-risk" : ""}>{part.rejectionRate === null ? "—" : `${part.rejectionRate.toFixed(1)}%`}</span>
            <span><i className="part-contribution-row__bar"><b style={{ width: `${Math.max(6, (part[metricConfig.value] / maxMetricValue) * 100)}%` }} /></i>{part[metricConfig.share].toFixed(1)}%</span>
            <span>{currency.format(part.failureCost)} <ArrowUpRight size={12} /></span>
          </button>)}
        </div>
      </div>
    </>}
  </section>;
}
