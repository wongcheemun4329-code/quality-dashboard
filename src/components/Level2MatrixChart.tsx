import type { CSSProperties } from "react";
import type { RejectCategoryLevel2Matrix } from "../data/qualityData";

type Props = {
  data: RejectCategoryLevel2Matrix;
  selectedKey?: string;
  quantityLabel: string;
  periodLabel: string;
  onSelect: (key: string) => void;
};

export function Level2MatrixChart({ data, selectedKey = "all", quantityLabel, periodLabel, onSelect }: Props) {
  if (!data.columns.length || !data.rows.length) {
    return <div className="level2-matrix level2-matrix--empty">No Level 2 reject quantities for the selected filters.</div>;
  }

  return <div className="level2-matrix" style={{ "--level2-period-count": data.columns.length } as CSSProperties}>
    <div className="level2-matrix__scroll" role="table" aria-label={`${quantityLabel} by Level 2 reason and ${periodLabel}`}>
      <div className="level2-matrix__grid level2-matrix__head" role="row">
        <span role="columnheader">Problem type Lv2</span>
        {data.columns.map((column) => <span role="columnheader" key={column.key}>{column.label}</span>)}
      </div>
      {data.rows.map((row) => <div className={`level2-matrix__grid level2-matrix__row${selectedKey === row.key ? " is-selected" : ""}`} role="row" key={row.key}>
        <button type="button" className="level2-matrix__reason" role="rowheader" onClick={() => onSelect(row.key)} title={`Filter ${row.name}`}>
          <span>{row.name}</span>
          <strong>{row.total.toLocaleString()}</strong>
        </button>
        {data.columns.map((column) => {
          const value = row.values[column.key] ?? 0;
          const width = data.max ? Math.max(value ? 4 : 0, (value / data.max) * 100) : 0;
          return <button type="button" className={`level2-matrix__cell${selectedKey === row.key ? " is-selected" : ""}`} role="cell" key={column.key} onClick={() => onSelect(row.key)} aria-label={`${row.name}, ${column.label}: ${value.toLocaleString()} ${quantityLabel}`}>
            {value > 0 ? <span className="level2-matrix__bar" style={{ width: `${width}%` }} /> : null}
            <span className="level2-matrix__value">{value ? value.toLocaleString() : ""}</span>
          </button>;
        })}
      </div>)}
    </div>
  </div>;
}
