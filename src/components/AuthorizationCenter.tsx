import { useMemo, useState } from "react";
import { Check, ClipboardPenLine, History, LockKeyhole, Plus, RotateCcw, ShieldCheck, UserCog, UserPlus, X } from "lucide-react";
import {
  canApproveEntry,
  canCreateModule,
  canViewEntry,
  dataModules,
  departments,
  getDepartment,
  getModule,
  getUser,
  hasPermission,
  makeAudit,
  makeRawEntry,
  roleMeta,
  rolePermissions,
  activeDefectLevel1ForProcess,
  activeDefectLevel2ForProcessAndLevel1,
  isFocusedPaintProcess,
  technicianProcessLabel,
  type AccessRole,
  type AccessState,
  type AccessUser,
  type DataModule,
  type DepartmentId,
  type RawEntry,
  type RecordStatus,
} from "../data/accessControl";
import { useAccess } from "../context/AccessContext";
import { useLanguage } from "../i18n";

type PanelKey = "users" | "inputs" | "review" | "audit";

const statusClass: Record<RecordStatus, string> = {
  Draft: "governance-status governance-status--draft",
  Submitted: "governance-status governance-status--submitted",
  "Under review": "governance-status governance-status--review",
  Approved: "governance-status governance-status--approved",
  Rejected: "governance-status governance-status--rejected",
  Locked: "governance-status governance-status--locked"
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function categoryLabel(value: string, language: "en" | "zh") {
  if (language !== "zh") return value;
  const labels: Record<string, string> = {
    "Cleaning & Chemical Treatment": "清洁与化学处理",
    "Surface Condition & Corrosion": "表面状态与腐蚀",
    "Appearance & Coverage": "外观与覆盖",
    "Adhesion, Cure & Colour": "附着力、固化与颜色",
    "Drawing/specification nonconformance": "图纸/规格不符合",
    "Cosmetic / appearance": "外观问题",
    "Material / component": "材料/部件",
    "Functional / performance": "功能/性能",
    "Process / workmanship": "工艺/作业",
    "Missing / incorrect part": "缺失/错误零件",
    "Other": "其他"
  };
  return labels[value] ?? value;
}

function fieldLabel(value: string, language: "en" | "zh") {
  if (language !== "zh") return value;
  if (value === "Process") return "工艺";
  if (value === "Reject category Level 1") return "缺陷一级类别";
  if (value === "Reject category Level 2") return "缺陷二级原因";
  if (value === "Defect description") return "缺陷描述";
  return value;
}

function EntryRow({ entry, state, onSubmit, onApprove, onReject, onLock }: { entry: RawEntry; state: AccessState; onSubmit: (entry: RawEntry) => void; onApprove: (entry: RawEntry) => void; onReject: (entry: RawEntry) => void; onLock: (entry: RawEntry) => void }) {
  const module = getModule(entry.moduleId);
  const creator = getUser(entry.createdBy, state.users);
  const actor = getUser(state.currentUserId, state.users)!;
  const canSubmit = entry.createdBy === actor.id && (entry.status === "Draft" || entry.status === "Rejected");
  const canApprove = canApproveEntry(actor, entry) && (entry.status === "Submitted" || entry.status === "Under review");
  const canLock = hasPermission(actor, "raw.approve") && entry.status === "Approved";
  return <div className="governance-entry-row">
    <div className="governance-entry-main"><strong>{entry.id}</strong><span>{module.label}</span><small>{getDepartment(entry.departmentId).shortName} · created by {creator?.name ?? "Unknown user"}</small></div>
    <span className={statusClass[entry.status]}>{entry.status}</span>
    <time>{formatTimestamp(entry.updatedAt)}</time>
    <div className="governance-entry-actions">
      {canSubmit ? <button type="button" title="Submit for review" aria-label={`Submit ${entry.id} for review`} onClick={() => onSubmit(entry)}><ClipboardPenLine size={14} /></button> : null}
      {canApprove ? <button type="button" title="Approve record" aria-label={`Approve ${entry.id}`} onClick={() => onApprove(entry)}><Check size={14} /></button> : null}
      {canApprove ? <button type="button" title="Reject record" aria-label={`Reject ${entry.id}`} onClick={() => onReject(entry)}><X size={14} /></button> : null}
      {canLock ? <button type="button" title="Lock approved record" aria-label={`Lock ${entry.id}`} onClick={() => onLock(entry)}><LockKeyhole size={14} /></button> : null}
    </div>
  </div>;
}

export function AuthorizationCenter() {
  const { state, setState, reset } = useAccess();
  const { language } = useLanguage();
  const [panel, setPanel] = useState<PanelKey>("users");
  const [selectedModuleId, setSelectedModuleId] = useState(dataModules[0].id);
  const [draftFields, setDraftFields] = useState<Record<string, string>>({});
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDepartment, setInviteDepartment] = useState<DepartmentId>("production");
  const [inviteRole, setInviteRole] = useState<AccessRole>("data-entry");
  const [notice, setNotice] = useState("Access policies are enforced for this local workspace.");

  const actor = state.users.find((user) => user.id === state.currentUserId) ?? state.users[0];
  const selectedModule = useMemo(() => {
    const module = getModule(selectedModuleId);
    const active = state.masterData;
    const selectedProcess = draftFields.process;
    const selectedRoutes = active.processRoutes.filter((route) => route.status === "Active" && (!selectedProcess || route.process === selectedProcess));
    const optionMap: Record<string, string[]> = {
      supplier: active.suppliers.filter((row) => row.status === "Active").map((row) => row.name),
      customer: active.customers.filter((row) => row.status === "Active").map((row) => row.name),
      partNumber: active.parts.filter((row) => row.status === "Active").map((row) => row.partNumber),
      material: active.parts.filter((row) => row.status === "Active").map((row) => row.name),
      process: [...new Set(active.processRoutes.filter((row) => row.status === "Active").map((row) => row.process))],
      workCenter: [...new Set(selectedRoutes.map((row) => row.workCenter))],
      machine: [...new Set(selectedRoutes.map((row) => row.machine))],
      rejectCategoryLevel1: (selectedProcess ? activeDefectLevel1ForProcess(active, selectedProcess) : active.defectLevel1.filter((row) => row.status === "Active")).map((row) => row.name),
      rejectCategoryLevel2: (selectedProcess ? activeDefectLevel2ForProcessAndLevel1(active, selectedProcess, draftFields.rejectCategoryLevel1) : active.defectLevel2.filter((reason) => reason.status === "Active" && (!draftFields.rejectCategoryLevel1 || reason.level1Id === active.defectLevel1.find((row) => row.name === draftFields.rejectCategoryLevel1)?.id))).map((reason) => reason.reason)
    };
    return {
      ...module,
      fields: module.fields.map((field) => optionMap[field.key]?.length
        ? { ...field, type: "select" as const, options: optionMap[field.key] }
        : field)
    };
  }, [draftFields.process, draftFields.rejectCategoryLevel1, selectedModuleId, state.masterData]);
  const visibleEntries = useMemo(() => state.entries.filter((entry) => canViewEntry(actor, entry)), [actor, state.entries]);
  const pendingEntries = useMemo(() => visibleEntries.filter((entry) => entry.status === "Submitted" || entry.status === "Under review"), [visibleEntries]);
  const openEntries = useMemo(() => visibleEntries.filter((entry) => entry.status !== "Locked"), [visibleEntries]);
  const manageableUsers = hasPermission(actor, "users.manage");

  const commit = (next: AccessState, message: string) => {
    setState(next);
    setNotice(message);
  };

  const appendAudit = (next: AccessState, action: string, target: string, detail: string) => ({ ...next, audit: [makeAudit(actor.id, action, target, detail), ...next.audit].slice(0, 80) });

  const switchActor = (id: string) => {
    const next = { ...state, currentUserId: id };
    commit(next, `Acting user switched to ${getUser(id, state.users)?.name ?? "selected user"}.`);
  };

  const invite = () => {
    if (!manageableUsers || !inviteName.trim() || !inviteEmail.trim()) return;
    const id = `USR-${String(state.users.length + 1).padStart(3, "0")}`;
    const user: AccessUser = { id, name: inviteName.trim(), email: inviteEmail.trim(), departmentId: inviteDepartment, plantId: "plant-01", status: "Invited", roles: [inviteRole] };
    const next = appendAudit({ ...state, users: [...state.users, user] }, "User invited", id, `Invited ${user.name} as ${roleMeta[inviteRole].label}`);
    commit(next, `${user.name} has been invited with ${roleMeta[inviteRole].label} access.`);
    setInviteName(""); setInviteEmail("");
  };

  const updateUser = (userId: string, change: Partial<AccessUser>, detail: string) => {
    if (!manageableUsers) return;
    const users = state.users.map((user) => user.id === userId ? { ...user, ...change } : user);
    commit(appendAudit({ ...state, users }, "User access changed", userId, detail), detail);
  };

  const selectModule = (module: DataModule) => {
    setSelectedModuleId(module.id);
    setDraftFields(Object.fromEntries(module.fields.map((field) => [field.key, ""])));
  };

  const createEntry = () => {
    if (!canCreateModule(actor, selectedModule)) return;
    const missing = selectedModule.fields.filter((field) => field.required && !draftFields[field.key]?.trim());
    if (missing.length) { setNotice(`Complete required fields: ${missing.map((field) => field.label).join(", ")}.`); return; }
    const entry = makeRawEntry(selectedModule, draftFields, actor.id);
    const next = appendAudit({ ...state, entries: [entry, ...state.entries] }, "Record created", entry.id, `Created ${selectedModule.label}`);
    commit(next, `${entry.id} saved as a draft.`);
    setDraftFields(Object.fromEntries(selectedModule.fields.map((field) => [field.key, ""])));
  };

  const updateEntry = (entry: RawEntry, status: RecordStatus, detail: string) => {
    const updated = { ...entry, status, updatedBy: actor.id, updatedAt: new Date().toISOString(), reviewComment: status === "Rejected" ? "Returned for correction by reviewer." : entry.reviewComment };
    const entries = state.entries.map((candidate) => candidate.id === entry.id ? updated : candidate);
    const next = appendAudit({ ...state, entries }, status === "Approved" ? "Record approved" : status === "Rejected" ? "Record rejected" : status === "Locked" ? "Record locked" : "Record submitted", entry.id, detail);
    commit(next, `${entry.id} is now ${status.toLowerCase()}.`);
  };

  const resetDemo = () => {
    reset();
    setNotice("Demo users, master data, records and audit events have been restored.");
  };

  return <div className="page-stack">
    <section className="page-header governance-header"><div><div className="eyebrow">GOVERNANCE &amp; DATA CONTROL</div><h1>Access &amp; Workflows</h1><p>Manage users, department-owned inputs, approvals, and audit history</p></div><div className="governance-acting"><span>Acting user</span><select aria-label="Acting user" value={actor.id} onChange={(event) => switchActor(event.target.value)}>{state.users.filter((user) => user.status !== "Suspended").map((user) => <option key={user.id} value={user.id}>{user.name} · {roleMeta[user.roles[0]].label}</option>)}</select></div></section>

    <section className="governance-notice"><ShieldCheck size={17} /><div><strong>{actor.name} · {roleMeta[actor.roles[0]].label}</strong><span>{actor.demoAccess ? "Demo draft access is enabled for all department modules. " : null}{notice}</span></div><button type="button" onClick={resetDemo} title="Restore demo access data" aria-label="Restore demo access data"><RotateCcw size={14} /></button></section>

    <section className="governance-stats"><div><span>Active users</span><strong>{state.users.filter((user) => user.status === "Active").length}</strong><small>{state.users.filter((user) => user.status === "Invited").length} invitations pending</small></div><div><span>Department modules</span><strong>{dataModules.length}</strong><small>{departments.length} departments mapped</small></div><div><span>Open records</span><strong>{openEntries.length}</strong><small>{pendingEntries.length} awaiting review</small></div><div><span>Audit events</span><strong>{state.audit.length}</strong><small>Latest access activity tracked</small></div></section>

    <nav className="governance-tabs" aria-label="Governance workspace"><button type="button" className={panel === "users" ? "active" : ""} onClick={() => setPanel("users")}><UserCog size={15} />Users &amp; roles</button><button type="button" className={panel === "inputs" ? "active" : ""} onClick={() => setPanel("inputs")}><ClipboardPenLine size={15} />Department inputs</button><button type="button" className={panel === "review" ? "active" : ""} onClick={() => setPanel("review")}><Check size={15} />Review queue<span>{pendingEntries.length}</span></button><button type="button" className={panel === "audit" ? "active" : ""} onClick={() => setPanel("audit")}><History size={15} />Audit log</button></nav>

    {panel === "users" ? <section className="governance-grid">
      <article className="governance-panel"><div className="governance-panel-header"><div><h2>Users &amp; access</h2><p>Invite people and assign the least privilege required for their work.</p></div><UserPlus size={18} /></div><div className="governance-user-list">{state.users.map((user) => <div className="governance-user-row" key={user.id}><div className="governance-avatar">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div className="governance-user-main"><strong>{user.name}</strong><span>{user.email}</span><small>{getDepartment(user.departmentId).shortName} · {user.id}</small></div><select aria-label={`Role for ${user.name}`} value={user.roles[0]} disabled={!manageableUsers} onChange={(event) => updateUser(user.id, { roles: [event.target.value as AccessRole] }, `${user.name} is now a ${roleMeta[event.target.value as AccessRole].label}.`)}>{(Object.keys(roleMeta) as AccessRole[]).map((role) => <option key={role} value={role}>{roleMeta[role].label}</option>)}</select><select aria-label={`Status for ${user.name}`} value={user.status} disabled={!manageableUsers || user.id === actor.id} onChange={(event) => updateUser(user.id, { status: event.target.value as AccessUser["status"] }, `${user.name} status changed to ${event.target.value}.`)}><option>Active</option><option>Invited</option><option>Suspended</option></select></div>)}</div></article>
      <article className="governance-panel"><div className="governance-panel-header"><div><h2>Invite a new user</h2><p>Invitations start with one plant, one department, and one role.</p></div><Plus size={18} /></div><div className="governance-form"><label><span>Full name</span><input aria-label="Full name" value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="e.g. Nurul Hakim" /></label><label><span>Work email</span><input aria-label="Work email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" /></label><label><span>Department</span><select aria-label="Invite department" value={inviteDepartment} onChange={(event) => setInviteDepartment(event.target.value as DepartmentId)}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label><span>Starting role</span><select aria-label="Invite role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AccessRole)}>{(Object.keys(roleMeta) as AccessRole[]).map((role) => <option key={role} value={role}>{roleMeta[role].label}</option>)}</select></label><button className="primary-button" type="button" disabled={!manageableUsers || !inviteName.trim() || !inviteEmail.trim()} onClick={invite}><UserPlus size={14} />Send invitation</button>{!manageableUsers ? <small className="governance-help">Only Plant Admin and Platform Admin can invite users.</small> : null}</div></article>
      <article className="governance-panel governance-panel--wide"><div className="governance-panel-header"><div><h2>Role policy</h2><p>Permission groups currently configured for this plant.</p></div><LockKeyhole size={18} /></div><div className="role-policy-grid">{(Object.keys(roleMeta) as AccessRole[]).map((role) => <div key={role}><strong>{roleMeta[role].label}</strong><span>{roleMeta[role].description}</span><small>{rolePermissionsSummary(role)}</small></div>)}</div></article>
    </section> : null}

    {panel === "inputs" ? <section className="governance-input-layout"><article className="governance-panel module-list"><div className="governance-panel-header"><div><h2>Department input modules</h2><p>Each module has an accountable department and field owners.</p></div></div>{dataModules.map((module) => <button key={module.id} type="button" className={module.id === selectedModule.id ? "active" : ""} onClick={() => selectModule(module)}><span>{getDepartment(module.departmentId).shortName}</span><strong>{module.label}</strong><small>{module.fields.length} controlled fields</small></button>)}</article><article className="governance-panel input-form-panel"><div className="governance-panel-header"><div><h2>{selectedModule.label}</h2><p>{selectedModule.description}</p></div><span className="module-owner">Owner · {getDepartment(selectedModule.departmentId).shortName}</span></div><div className="field-owner-grid">{selectedModule.fields.map((field) => <div key={field.key}><strong>{fieldLabel(field.label, language)}{field.required ? " *" : ""}</strong><span>{getDepartment(field.owner).shortName}</span></div>)}</div><div className="governance-form governance-form--entry">{selectedModule.fields.map((field) => { const label = fieldLabel(field.label, language); const isLevel2 = field.key === "rejectCategoryLevel2"; const level2Disabled = isLevel2 && Boolean(draftFields.process && isFocusedPaintProcess(draftFields.process) && !draftFields.rejectCategoryLevel1); return <label key={field.key}><span>{label}{field.required ? " *" : ""}</span>{field.type === "select" ? <select aria-label={label} disabled={level2Disabled} value={draftFields[field.key] ?? ""} onChange={(event) => { const value = event.target.value; if (field.key === "process") setDraftFields({ ...draftFields, process: value, rejectCategoryLevel1: "", rejectCategoryLevel2: "" }); else if (field.key === "rejectCategoryLevel1") setDraftFields({ ...draftFields, rejectCategoryLevel1: value, rejectCategoryLevel2: "" }); else setDraftFields({ ...draftFields, [field.key]: value }); }}><option value="">{level2Disabled ? (language === "zh" ? "请先选择一级类别" : "Select Level 1 first") : (language === "zh" ? "请选择..." : "Select...")}</option>{field.options?.map((option, optionIndex) => <option key={`${field.key}-${option}-${optionIndex}`} value={option}>{field.key === "process" ? technicianProcessLabel(option) : categoryLabel(option, language)}</option>)}</select> : <input aria-label={label} type={field.type} value={draftFields[field.key] ?? ""} onChange={(event) => setDraftFields({ ...draftFields, [field.key]: event.target.value })} placeholder={field.placeholder} />}</label>; })}{draftFields.process && isFocusedPaintProcess(draftFields.process) ? <small className="governance-help">{language === "zh" ? `${technicianProcessLabel(draftFields.process)} 仅显示相关缺陷类别。请先选择一级类别，再选择详细的二级原因。` : `${technicianProcessLabel(draftFields.process)} shows only its relevant defect categories. Select Level 1 before choosing a detailed Level 2 reason.`}</small> : null}<div className="entry-submit"><button className="primary-button" type="button" disabled={!canCreateModule(actor, selectedModule)} onClick={createEntry}><Plus size={14} />Save draft</button>{!canCreateModule(actor, selectedModule) ? <small>You do not have permission to create this department’s records.</small> : <small>Saved records stay editable until submitted for review.</small>}</div></div></article></section> : null}

    {panel === "review" ? <section className="governance-panel"><div className="governance-panel-header"><div><h2>Review queue</h2><p>Maker-checker workflow: the creator cannot approve their own record.</p></div><span className="queue-count">{pendingEntries.length} pending</span></div><div className="governance-entry-list">{pendingEntries.length ? pendingEntries.map((entry) => <EntryRow key={entry.id} entry={entry} state={state} onSubmit={(candidate) => updateEntry(candidate, "Submitted", "Resubmitted the record for review")} onApprove={(candidate) => updateEntry(candidate, "Approved", "Approved after department review")} onReject={(candidate) => updateEntry(candidate, "Rejected", "Returned to creator for correction")} onLock={(candidate) => updateEntry(candidate, "Locked", "Locked approved record")} />) : <div className="empty-state">No records are waiting for review.</div>}</div></section> : null}

    {panel === "audit" ? <section className="governance-panel"><div className="governance-panel-header"><div><h2>Audit log</h2><p>Access changes and record state transitions are retained for traceability.</p></div><History size={18} /></div><div className="audit-list">{state.audit.map((event) => <div key={event.id}><div className="audit-icon"><History size={13} /></div><div><strong>{event.action}</strong><span>{event.detail}</span><small>{getUser(event.actorId, state.users)?.name ?? "Unknown user"} · {event.target}</small></div><time>{formatTimestamp(event.timestamp)}</time></div>)}</div></section> : null}

    {panel !== "audit" && panel !== "users" ? <section className="governance-panel governance-records"><div className="governance-panel-header"><div><h2>Recent raw records</h2><p>Drafts and approved records remain visible according to your scope.</p></div></div><div className="governance-entry-list">{openEntries.slice(0, 8).map((entry) => <EntryRow key={entry.id} entry={entry} state={state} onSubmit={(candidate) => updateEntry(candidate, "Submitted", "Submitted the record for review")} onApprove={(candidate) => updateEntry(candidate, "Approved", "Approved after review")} onReject={(candidate) => updateEntry(candidate, "Rejected", "Returned to creator for correction")} onLock={(candidate) => updateEntry(candidate, "Locked", "Locked approved record")} />)}</div></section> : null}
  </div>;
}

function rolePermissionsSummary(role: AccessRole) {
  const labels: Record<string, string> = { "users.manage": "Manage users", "roles.manage": "Assign roles", "raw.create": "Create records", "raw.edit-own": "Edit own drafts", "raw.review": "Review queue", "raw.approve": "Approve records", "raw.correct": "Correct records", "raw.export": "Export data", "audit.view": "Audit history" };
  return rolePermissions[role].map((permission) => labels[permission]).join(" · ");
}
