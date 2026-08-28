import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Database, Download, Edit3, FileSpreadsheet, Filter, LockKeyhole, Plus, Search, Upload, X } from "lucide-react";
import { useAccess } from "../context/AccessContext";
import {
  getUser,
  hasPermission,
  makeAudit,
  type DefectLevel1Record,
  type DefectLevel2Record,
  type MasterDataState,
  type MasterOperation,
  type MasterStatus,
  type PartRecord,
  type ProcessRouteRecord,
  type SupplierRecord,
  type CustomerRecord
} from "../data/accessControl";
import { technicianProcessLabel } from "../data/accessControl";
import {
  downloadMasterDataWorkbook,
  generateMasterId,
  parseMasterDataWorkbook,
  validateMasterData,
  type MasterImportPreview,
  type MasterSection
} from "../data/masterData";
import { useLanguage } from "../i18n";

type TabKey = "suppliers" | "customers" | "parts" | "routes" | "defectLevel1" | "defectLevel2";
type EditKind = "suppliers" | "customers" | "parts" | "processRoutes" | "defectLevel1" | "defectLevel2";
type EditableRecord = SupplierRecord | CustomerRecord | PartRecord | ProcessRouteRecord | DefectLevel1Record | DefectLevel2Record;
type FormState = Record<string, string>;

const operations: MasterOperation[] = ["sheet-metal", "precision-machining"];
const operationLabel: Record<MasterOperation, string> = { "sheet-metal": "Sheet Metal", "precision-machining": "Precision Machining" };
const tabKinds: Record<TabKey, EditKind[]> = {
  suppliers: ["suppliers"], customers: ["customers"], parts: ["parts"], routes: ["processRoutes"], defectLevel1: ["defectLevel1"], defectLevel2: ["defectLevel2"]
};

const copy = <T,>(value: T): T => structuredClone(value);
const normalize = (value: string) => value.trim().toLocaleLowerCase();

function titleFor(kind: EditKind, language: "en" | "zh") {
  const titles = {
    en: { suppliers: "Supplier", customers: "Customer", parts: "Part", processRoutes: "Process route", defectLevel1: "Defect Level 1", defectLevel2: "Defect Level 2" },
    zh: { suppliers: "供应商", customers: "客户", parts: "零件", processRoutes: "工艺路线", defectLevel1: "一级缺陷", defectLevel2: "二级缺陷" }
  };
  return titles[language][kind];
}

function recordToForm(kind: EditKind, record?: EditableRecord): FormState {
  if (!record) return { status: "Active", operation: "sheet-metal", partType: "Production", processIds: "" };
  const form = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : String(value)]));
  return form;
}

function formToRecord(kind: EditKind, form: FormState, id: string): EditableRecord {
  const status = form.status as MasterStatus;
  if (kind === "suppliers" || kind === "customers") return { id, name: form.name?.trim(), country: form.country?.trim(), status };
  if (kind === "parts") return { id, partNumber: form.partNumber?.trim(), name: form.name?.trim(), partType: form.partType as PartRecord["partType"], operation: form.operation as MasterOperation, status };
  if (kind === "processRoutes") return { id, process: form.process?.trim(), operation: form.operation as MasterOperation, workCenter: form.workCenter?.trim(), machine: form.machine?.trim(), status };
  if (kind === "defectLevel1") return { id, name: form.name?.trim(), processIds: form.processIds?.split(",").map((value) => value.trim()).filter(Boolean) ?? [], status };
  return { id, reason: form.reason?.trim(), level1Id: form.level1Id, processIds: form.processIds?.split(",").map((value) => value.trim()).filter(Boolean) ?? [], status };
}

function containsSearch(kind: EditKind, record: EditableRecord, search: string) {
  if (!search) return true;
  const text = kind === "defectLevel2"
    ? Object.values(record).flat().join(" ")
    : Object.values(record).join(" ");
  return normalize(text).includes(normalize(search));
}

function RecordFields({ kind, form, setForm, masterData }: { kind: EditKind; form: FormState; setForm: (next: FormState) => void; masterData: MasterDataState }) {
  const field = (key: string, label: string, required = true) => <label><span>{label}{required ? " *" : ""}</span><input value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={required} /></label>;
  const status = <label><span>Status *</span><select value={form.status ?? "Active"} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>;
  const operation = <label><span>Operation *</span><select value={form.operation ?? "sheet-metal"} onChange={(event) => setForm({ ...form, operation: event.target.value })}>{operations.map((value) => <option value={value} key={value}>{operationLabel[value]}</option>)}</select></label>;
  if (kind === "suppliers" || kind === "customers") return <>{field("name", "Name")}{field("country", "Country")}{status}</>;
  if (kind === "parts") return <>{field("partNumber", "Part number")}{field("name", "Part name")}<label><span>Part type *</span><select value={form.partType ?? "Production"} onChange={(event) => setForm({ ...form, partType: event.target.value })}><option>NPI</option><option>Production</option></select></label>{operation}{status}</>;
  if (kind === "processRoutes") return <>{field("process", "Process")}{operation}{field("workCenter", "Work center")}{field("machine", "Machine")}{status}</>;
  if (kind === "defectLevel1") {
    const selected = new Set(form.processIds?.split(",").filter(Boolean));
    const linkedRoutes = masterData.processRoutes.filter((row) => row.status === "Active" || selected.has(row.id));
    return <>{field("name", "Category name")}<label><span>Linked process routes</span><select multiple value={[...selected]} onChange={(event) => setForm({ ...form, processIds: Array.from(event.target.selectedOptions).map((option) => option.value).join(",") })}>{linkedRoutes.map((row) => <option value={row.id} key={row.id}>{technicianProcessLabel(row.process)} · {row.workCenter} · {row.id}</option>)}</select><small>Leave empty for a universal fallback category.</small></label>{status}</>;
  }
  const activeLevel1 = masterData.defectLevel1.filter((row) => row.status === "Active" || row.id === form.level1Id);
  const activeRoutes = masterData.processRoutes.filter((row) => row.status === "Active" || form.processIds?.split(",").includes(row.id));
  const selected = new Set(form.processIds?.split(",").filter(Boolean));
  return <>{field("reason", "Reason")}<label><span>Linked Level 1 *</span><select value={form.level1Id ?? ""} onChange={(event) => setForm({ ...form, level1Id: event.target.value })}><option value="">Select category...</option>{activeLevel1.map((row) => <option value={row.id} key={row.id}>{row.name} · {row.id}</option>)}</select></label><label><span>Linked processes *</span><select multiple value={[...selected]} onChange={(event) => setForm({ ...form, processIds: Array.from(event.target.selectedOptions).map((option) => option.value).join(",") })}>{activeRoutes.map((row) => <option value={row.id} key={row.id}>{row.process} · {row.workCenter}</option>)}</select><small>Use Ctrl/Cmd to select multiple processes.</small></label>{status}</>;
}

function StatusBadge({ status }: { status: MasterStatus }) {
  return <span className={`master-status master-status--${status.toLowerCase()}`}>{status}</span>;
}

export function DatabaseSettings() {
  const { state, setState } = useAccess();
  const { language, t } = useLanguage();
  const [tab, setTab] = useState<TabKey>("suppliers");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MasterStatus>("all");
  const [operationFilter, setOperationFilter] = useState<"all" | MasterOperation>("all");
  const [editor, setEditor] = useState<{ kind: EditKind; id?: string } | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<MasterImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const actor = getUser(state.currentUserId, state.users) ?? state.users[0];
  const canManage = hasPermission(actor, "users.manage");
  const md = state.masterData;

  const labels = language === "zh" ? {
    eyebrow: "主数据管理", title: "数据库设置", subtitle: "集中维护质量工作区使用的主数据", search: "搜索当前数据库", allStatus: "全部状态", allOperations: "全部工序", add: "新增", edit: "编辑", save: "保存记录", cancel: "取消", export: "导出主数据", import: "导入主数据", readOnly: "只读权限", active: "启用", inactive: "停用", noRows: "没有符合筛选条件的记录。", preview: "导入验证预览", apply: "应用导入", valid: "所有行均有效，可以应用。", invalid: "请修正所有错误后重新导入。",
    tabs: { suppliers: "供应商", customers: "客户", parts: "零件", routes: "工艺与工作中心", defectLevel1: "一级缺陷", defectLevel2: "二级缺陷" }
  } : {
    eyebrow: "MASTER DATA CONTROL", title: "Database Settings", subtitle: "Maintain the shared master records used across the quality workspace", search: "Search current database", allStatus: "All statuses", allOperations: "All operations", add: "Add", edit: "Edit", save: "Save record", cancel: "Cancel", export: "Export Master Data", import: "Import Master Data", readOnly: "Read-only access", active: "Active", inactive: "Inactive", noRows: "No records match the current filters.", preview: "Import validation preview", apply: "Apply import", valid: "Every row is valid and ready to apply.", invalid: "Correct every error and import the workbook again.",
    tabs: { suppliers: "Suppliers", customers: "Customers", parts: "Parts", routes: "Processes & Work Centers", defectLevel1: "Defect Level 1", defectLevel2: "Defect Level 2" }
  };

  const records = useMemo(() => {
    const kinds = tabKinds[tab];
    return kinds.flatMap((kind) => (md[kind] as EditableRecord[]).map((record) => ({ kind, record }))).filter(({ kind, record }) => {
      const operation = "operation" in record ? record.operation : null;
      return containsSearch(kind, record, search)
        && (statusFilter === "all" || record.status === statusFilter)
        && (operationFilter === "all" || operation === null || operation === operationFilter);
    });
  }, [md, operationFilter, search, statusFilter, tab]);

  const total = tabKinds[tab].reduce((sum, kind) => sum + md[kind].length, 0);
  const active = tabKinds[tab].reduce((sum, kind) => sum + md[kind].filter((row) => row.status === "Active").length, 0);
  const openEditor = (kind: EditKind, record?: EditableRecord) => { setEditor({ kind, id: record?.id }); setForm(recordToForm(kind, record)); setNotice(""); };
  const closeEditor = () => { setEditor(null); setForm({}); };

  const commitMasterData = (nextMasterData: MasterDataState, action: string, target: string, detail: string) => {
    setState((current) => ({
      ...current,
      masterData: nextMasterData,
      suppliers: nextMasterData.suppliers,
      customers: nextMasterData.customers,
      audit: [makeAudit(actor.id, action, target, detail), ...current.audit].slice(0, 80)
    }));
    setNotice(detail);
  };

  const saveRecord = () => {
    if (!canManage || !editor) return;
    const next = copy(md);
    const section = editor.kind as MasterSection;
    const rows = next[section] as EditableRecord[];
    const id = editor.id ?? generateMasterId(section, next);
    const record = formToRecord(editor.kind, form, id);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) rows.push(record); else rows[index] = record;
    const issues = validateMasterData(next);
    if (issues.length) { setNotice(issues[0].message); return; }
    const noun = titleFor(editor.kind, language);
    const verb = index < 0 ? "created" : "edited";
    commitMasterData(next, `Master data ${verb}`, id, `${noun} ${id} was ${verb}.`);
    closeEditor();
  };

  const toggleStatus = (kind: EditKind, record: EditableRecord) => {
    if (!canManage) return;
    const next = copy(md);
    const rows = next[kind] as EditableRecord[];
    const candidate = rows.find((row) => row.id === record.id)!;
    const nextStatus: MasterStatus = candidate.status === "Active" ? "Inactive" : "Active";
    candidate.status = nextStatus;
    const issues = validateMasterData(next);
    if (issues.length) { setNotice(issues[0].message); return; }
    commitMasterData(next, `Master data ${nextStatus === "Active" ? "activated" : "deactivated"}`, record.id, `${titleFor(kind, language)} ${record.id} is now ${nextStatus}.`);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canManage) return;
    setImportBusy(true); setNotice("");
    try { setPreview(await parseMasterDataWorkbook(file, md)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to read the workbook."); }
    finally { setImportBusy(false); }
  };

  const applyImport = () => {
    if (!preview || preview.issues.length || !canManage) return;
    commitMasterData(preview.next, "Master data workbook imported", "Master data", `Applied ${preview.additions} additions and ${preview.updates} updates from workbook import.`);
    setPreview(null);
  };

  const renderCells = (kind: EditKind, record: EditableRecord) => {
    if (kind === "suppliers" || kind === "customers") { const row = record as SupplierRecord; return <><td><strong>{row.name}</strong><small>{row.id}</small></td><td>{row.country}</td><td><StatusBadge status={row.status} /></td></>; }
    if (kind === "parts") { const row = record as PartRecord; return <><td><strong>{row.partNumber}</strong><small>{row.id}</small></td><td>{row.name}</td><td>{row.partType}</td><td>{operationLabel[row.operation]}</td><td><StatusBadge status={row.status} /></td></>; }
    if (kind === "processRoutes") { const row = record as ProcessRouteRecord; return <><td><strong>{technicianProcessLabel(row.process)}</strong><small>{row.id}</small></td><td>{operationLabel[row.operation]}</td><td>{row.workCenter}</td><td>{row.machine}</td><td><StatusBadge status={row.status} /></td></>; }
    if (kind === "defectLevel1") { const row = record as DefectLevel1Record; const processes = row.processIds.map((id) => md.processRoutes.find((item) => item.id === id)).filter(Boolean).map((item) => `${technicianProcessLabel(item!.process)} · ${item!.workCenter}`).join(", "); return <><td><strong>{row.name}</strong><small>{row.id}</small></td><td>{processes || "Universal fallback"}</td><td><StatusBadge status={row.status} /></td></>; }
    const row = record as DefectLevel2Record;
    const level1 = md.defectLevel1.find((item) => item.id === row.level1Id)?.name ?? row.level1Id;
    const processes = row.processIds.map((id) => md.processRoutes.find((item) => item.id === id)?.process ?? id).join(", ");
    return <><td><strong>{row.reason}</strong><small>{row.id} · Level 2</small></td><td>{level1}</td><td>{processes}</td><td><StatusBadge status={row.status} /></td></>;
  };

  const headers = tab === "suppliers" || tab === "customers" ? ["Name / ID", "Country", "Status"]
    : tab === "parts" ? ["Part number / ID", "Part name", "Type", "Operation", "Status"]
    : tab === "routes" ? ["Process / ID", "Operation", "Work center", "Machine", "Status"]
    : tab === "defectLevel1" ? ["Category name / ID", "Linked processes", "Status"]
    : ["Reason / ID", "Linked Level 1", "Linked processes", "Status"];

  return <div className="page-stack master-data-page">
    <section className="page-header master-data-header"><div><div className="eyebrow">{labels.eyebrow}</div><h1>{labels.title}</h1><p>{labels.subtitle}</p></div><div className="master-data-actions"><button className="secondary-button" type="button" onClick={() => downloadMasterDataWorkbook(md)}><Download size={15} />{labels.export}</button><input ref={fileInput} hidden type="file" accept=".xlsx" onChange={handleImport} /><button className="primary-button" type="button" disabled={!canManage || importBusy} onClick={() => fileInput.current?.click()}><Upload size={15} />{importBusy ? "Validating..." : labels.import}</button></div></section>

    {!canManage ? <section className="master-data-permission"><LockKeyhole size={16} /><span>{labels.readOnly}. Plant Admin or Platform Admin permission is required to modify master records.</span></section> : null}
    {notice ? <section className="master-data-notice"><CheckCircle2 size={15} /><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={14} /></button></section> : null}

    <nav className="master-data-tabs" aria-label="Database tables">{(Object.keys(labels.tabs) as TabKey[]).map((key) => <button type="button" key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setSearch(""); setOperationFilter("all"); }}><span>{labels.tabs[key]}</span><small>{tabKinds[key].reduce((sum, kind) => sum + md[kind].length, 0)}</small></button>)}</nav>

    <section className="master-data-summary"><div><span>Total records</span><strong>{total}</strong></div><div><span>{labels.active}</span><strong>{active}</strong></div><div><span>{labels.inactive}</span><strong>{total - active}</strong></div><div><span>Visible</span><strong>{records.length}</strong></div></section>

    <section className="master-data-workspace">
      <div className="master-data-toolbar"><label className="master-data-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} /></label><label><Filter size={14} /><select aria-label="Status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">{labels.allStatus}</option><option>Active</option><option>Inactive</option></select></label>{tab === "parts" || tab === "routes" ? <label><select aria-label="Operation filter" value={operationFilter} onChange={(event) => setOperationFilter(event.target.value as typeof operationFilter)}><option value="all">{labels.allOperations}</option>{operations.map((value) => <option value={value} key={value}>{operationLabel[value]}</option>)}</select></label> : null}<div className="master-data-add-buttons"><button type="button" disabled={!canManage} onClick={() => openEditor(tabKinds[tab][0])}><Plus size={14} />{labels.add}</button></div></div>
      <div className="master-data-table-wrap"><table className="master-data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}<th aria-label="Actions" /></tr></thead><tbody>{records.map(({ kind, record }) => <tr key={`${kind}-${record.id}`}><>{renderCells(kind, record)}</><td className="master-data-row-actions"><button type="button" disabled={!canManage} title={labels.edit} aria-label={`${labels.edit} ${record.id}`} onClick={() => openEditor(kind, record)}><Edit3 size={14} /></button><button type="button" disabled={!canManage} className={record.status === "Active" ? "deactivate" : "activate"} onClick={() => toggleStatus(kind, record)}>{record.status === "Active" ? labels.inactive : labels.active}</button></td></tr>)}{!records.length ? <tr><td colSpan={headers.length + 1} className="master-data-empty"><Database size={22} />{labels.noRows}</td></tr> : null}</tbody></table></div>
    </section>

    {editor ? <div className="master-data-drawer-layer"><button className="master-data-drawer-scrim" type="button" aria-label="Close editor" onClick={closeEditor} /><aside className="master-data-drawer" role="dialog" aria-modal="true" aria-label={`${editor.id ? labels.edit : labels.add} ${titleFor(editor.kind, language)}`}><header><div><span>{editor.id ? editor.id : "NEW MASTER RECORD"}</span><h2>{editor.id ? labels.edit : labels.add} {titleFor(editor.kind, language)}</h2></div><button type="button" aria-label="Close editor" onClick={closeEditor}><X size={18} /></button></header><div className="master-data-form"><RecordFields kind={editor.kind} form={form} setForm={setForm} masterData={md} /></div><footer><button type="button" className="secondary-button" onClick={closeEditor}>{labels.cancel}</button><button type="button" className="primary-button" onClick={saveRecord}><CheckCircle2 size={15} />{labels.save}</button></footer></aside></div> : null}

    {preview ? <div className="master-data-drawer-layer"><button className="master-data-drawer-scrim" type="button" aria-label="Close import preview" onClick={() => setPreview(null)} /><section className="master-import-modal" role="dialog" aria-modal="true"><header><div><span>WORKBOOK VALIDATION</span><h2>{labels.preview}</h2></div><button type="button" onClick={() => setPreview(null)} aria-label="Close import preview"><X size={18} /></button></header><div className="master-import-totals"><div><strong>{preview.additions}</strong><span>Additions</span></div><div><strong>{preview.updates}</strong><span>Updates</span></div><div><strong>{preview.unchanged}</strong><span>Unchanged</span></div><div className={preview.issues.length ? "has-errors" : "is-valid"}><strong>{preview.issues.length}</strong><span>Errors</span></div></div><div className="master-import-sheets">{Object.entries(preview.bySheet).map(([sheet, result]) => <div key={sheet}><strong>{sheet}</strong><span>{result.additions} add · {result.updates} update · {result.unchanged} same · {result.errors} error</span></div>)}</div>{preview.issues.length ? <div className="master-import-errors">{preview.issues.slice(0, 30).map((issue, index) => <div key={`${issue.sheet}-${issue.row}-${index}`}><strong>{issue.sheet} · row {issue.row} · {issue.field}</strong><span>{issue.message}</span></div>)}</div> : <div className="master-import-valid"><FileSpreadsheet size={18} />{labels.valid}</div>}<footer><button className="secondary-button" type="button" onClick={() => setPreview(null)}>{labels.cancel}</button><button className="primary-button" type="button" disabled={preview.issues.length > 0} onClick={applyImport}>{labels.apply}</button></footer></section></div> : null}
  </div>;
}
