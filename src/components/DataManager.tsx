import { useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useAccess } from "../context/AccessContext";
import { clearStoredDataset, downloadQualityHeaders, downloadQualityWorkbook, operationMeta, parseQualityWorkbook, persistDataset, sampleDataset, type ImportPreview, type OperationKey, type QualityDataset } from "../data/qualityData";
import { InspectionTable } from "./InspectionTable";

type Props = { dataset: QualityDataset; onDatasetChange: (dataset: QualityDataset) => void };

export function DataManager({ dataset, onDatasetChange }: Props) {
  const { state } = useAccess();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Active dataset is stored in this browser.");
  const [headerFormat, setHeaderFormat] = useState<"xlsx" | "xls" | "csv">("xlsx");
  const [templateMode, setTemplateMode] = useState<"headers" | "manual">("headers");

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("Validating workbook...");
    try {
      const nextPreview = await parseQualityWorkbook(file, state.masterData);
      setPreview(nextPreview);
      setMessage(nextPreview.issues.length ? `${nextPreview.issues.length} validation issue${nextPreview.issues.length === 1 ? "" : "s"} found.` : "Workbook is valid and ready to apply.");
    } catch {
      setPreview(null);
      setMessage("The selected file could not be read. Use the exported workbook structure.");
    } finally { setBusy(false); }
  };

  const applyImport = () => {
    if (!preview || preview.issues.length || !preview.dataset.inspections.length) return;
    persistDataset(preview.dataset);
    onDatasetChange(preview.dataset);
    setMessage(`${preview.fileName} is now the active local dataset.`);
    setPreview(null);
  };

  const restore = () => {
    clearStoredDataset();
    onDatasetChange(sampleDataset);
    setPreview(null);
    setMessage("The bundled 12-month sample dataset has been restored.");
  };

  return <div className="page-stack">
    <section className="page-header"><div><div className="eyebrow">LOCAL DATA CONTROL</div><h1>Data Manager</h1><p>Validate, preview, and replace the active quality dataset</p></div><div className="page-actions"><button className="secondary-button" type="button" onClick={() => downloadQualityWorkbook(dataset)}><Download size={15} />Export active XLSX</button><label className="header-download"><span>Template</span><select aria-label="Template type" value={templateMode} onChange={(event) => setTemplateMode(event.target.value as typeof templateMode)}><option value="headers">Headers only</option><option value="manual">Manual + reference data</option></select></label><label className="header-download"><span>Format</span><select aria-label="Header format" value={headerFormat} onChange={(event) => setHeaderFormat(event.target.value as typeof headerFormat)}><option value="xlsx">XLSX</option><option value="xls">XLS</option><option value="csv">CSV</option></select></label><button className="secondary-button" type="button" onClick={() => downloadQualityHeaders(headerFormat, templateMode, dataset, state.masterData)}><Download size={15} />{templateMode === "manual" ? "Download manual template" : "Download headers"}</button><button className="primary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}><Upload size={15} />{busy ? "Reading file..." : "Import workbook"}</button><input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleFile} /></div></section>

    <section className="data-status-band"><Database size={18} /><div><strong>{dataset.inspections.length} inspection records · {dataset.complaints.length} complaints</strong><span>{message}</span></div><span className="status-pill"><i />Saved locally</span></section>

    <section className="data-manager-grid">
      <article className="data-panel import-panel">
        <div className="data-panel__header"><div><h2>Workbook import</h2><p>Apply is enabled only after every row passes validation.</p></div><FileSpreadsheet size={19} /></div>
        <div className="import-schema"><div><strong>Inspections</strong><span>Required sheet</span></div><div><strong>Complaints</strong><span>Optional sheet</span></div><div><strong>Deliveries</strong><span>Monthly customer totals</span></div><div><strong>Targets</strong><span>Optional sheet</span></div></div>
        {!preview ? <button className="drop-zone" type="button" onClick={() => fileInputRef.current?.click()}><Upload size={23} /><strong>Select an XLSX, XLS, or CSV file</strong><span>Use Download manual template for defect references and valid field values.</span></button> : <div className={`preview-summary ${preview.issues.length ? "preview-summary--error" : "preview-summary--valid"}`}>
          {preview.issues.length ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}<div><strong>{preview.fileName}</strong><span>{preview.dataset.inspections.length} valid inspections · {preview.dataset.complaints.length} valid complaints</span></div>
        </div>}
        {preview?.issues.length ? <div className="validation-list"><div className="validation-list__head"><strong>Validation issues</strong><span>First {Math.min(12, preview.issues.length)} shown</span></div>{preview.issues.slice(0, 12).map((issue, index) => <div key={`${issue.sheet}-${issue.row}-${issue.field}-${index}`}><span>{issue.sheet} · Row {issue.row}</span><strong>{issue.field}</strong><p>{issue.message}</p></div>)}</div> : null}
        {preview && !preview.issues.length ? <div className="valid-preview"><CheckCircle2 size={18} /><div><strong>Validation complete</strong><p>Applying this workbook will replace the active browser dataset.</p></div></div> : null}
        <div className="panel-actions"><button className="secondary-button" type="button" onClick={() => setPreview(null)} disabled={!preview}>Discard preview</button><button className="primary-button" type="button" onClick={applyImport} disabled={!preview || Boolean(preview.issues.length) || !preview.dataset.inspections.length}>Apply valid import</button></div>
      </article>

      <article className="data-panel">
        <div className="data-panel__header"><div><h2>Quality targets</h2><p>Operation-specific thresholds included in the workbook.</p></div></div>
        <div className="target-table"><div className="target-table__head"><span>Operation</span><span>Acceptance</span><span>Reject PPM</span><span>Complaint %</span><span>Complaint PPM</span></div>{(Object.keys(operationMeta) as OperationKey[]).map((key) => { const target = dataset.targets[key]; return <div key={key}><strong>{operationMeta[key].label}</strong><span>{target.fpy.toFixed(1)}%</span><span>{target.rejectPpm.toLocaleString()}</span><span>{target.complaintFpy.toFixed(1)}%</span><span>{target.complaintRejectPpm.toLocaleString()}</span></div>; })}</div>
        <div className="restore-box"><div><strong>Restore sample data</strong><p>Replaces the active dataset with the deterministic rolling 12-month demo.</p></div><button className="secondary-button" type="button" onClick={restore}><RotateCcw size={14} />Restore</button></div>
      </article>
    </section>

    <section className="data-panel"><div className="data-panel__header"><div><h2>Active inspection preview</h2><p>Latest 12 of {dataset.inspections.length} records in the current local dataset.</p></div><span className="status-pill"><i />Active</span></div><InspectionTable rows={[...dataset.inspections].sort((a, b) => b.date.localeCompare(a.date))} limit={12} /></section>
  </div>;
}
