import { deriveRejectCategoryLevel1, deriveRejectCategoryLevel2, operationMeta, stageMeta, type InspectionRecord } from "../data/qualityData";

export function InspectionTable({ rows, limit = 20 }: { rows: InspectionRecord[]; limit?: number }) {
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Operation</th><th>Stage</th><th>Part / work order</th><th>Process / machine</th><th>Reject category</th><th>Acceptance</th><th>Scrap cost</th><th>Severity</th></tr></thead><tbody>{rows.slice(0, limit).map((row) => {
    const fpy = row.inspectedQty ? (row.firstPassGoodQty / row.inspectedQty) * 100 : null;
    const level1 = row.rejectCategoryLevel1 || deriveRejectCategoryLevel1(row.defectCategory);
    const level2 = row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(row.process, row.defectCategory);
    return <tr key={row.id}><td>{row.date}<small>{row.id}</small></td><td>{operationMeta[row.operation].label}</td><td>{stageMeta[row.stage].shortLabel}</td><td><strong>{row.partNumber}</strong><small>{row.workOrder}</small></td><td>{row.process}<small>{row.machine}</small></td><td><strong>{level1}</strong><small>{level2}</small><small>{row.defectCategory} · {row.rootCause}</small></td><td>{fpy === null ? "—" : `${fpy.toFixed(1)}%`}</td><td>RM {row.scrapCost.toLocaleString()}</td><td><span className={`severity severity--${row.severity.toLowerCase()}`}>{row.severity}</span></td></tr>;
  })}</tbody></table>{!rows.length ? <div className="empty-state">No inspection records match the current filters.</div> : null}</div>;
}
