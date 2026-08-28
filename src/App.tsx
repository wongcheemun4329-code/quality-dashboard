import { lazy, Suspense, useEffect, useState } from "react";
import { BarChart3, ChevronRight, Database, Factory, Menu, Microscope, RefreshCw, Settings2, ShieldCheck, UserCog } from "lucide-react";
import { defaultFilters, loadStoredDataset, operationMeta, type DashboardFilters, type OperationKey, type QualityDataset } from "./data/qualityData";
import { operationLabel, useLanguage } from "./i18n";

const ExecutiveOverview = lazy(() => import("./components/ExecutiveOverview").then((module) => ({ default: module.ExecutiveOverview })));
const QualityExplorer = lazy(() => import("./components/QualityExplorer").then((module) => ({ default: module.QualityExplorer })));
const DataManager = lazy(() => import("./components/DataManager").then((module) => ({ default: module.DataManager })));
const DatabaseSettings = lazy(() => import("./components/DatabaseSettings").then((module) => ({ default: module.DatabaseSettings })));
const AuthorizationCenter = lazy(() => import("./components/AuthorizationCenter").then((module) => ({ default: module.AuthorizationCenter })));

export type ViewKey = "overview" | "explorer" | "data" | "database" | "governance";
const viewMeta: Record<ViewKey, { labelKey: string; icon: typeof BarChart3 }> = {
  overview: { labelKey: "executiveOverview", icon: BarChart3 },
  explorer: { labelKey: "qualityExplorer", icon: Microscope },
  data: { labelKey: "dataManager", icon: Database },
  database: { labelKey: "databaseSettings", icon: Settings2 },
  governance: { labelKey: "accessWorkflows", icon: UserCog }
};
const SCROLL_POSITION_KEY = "manufacturing-quality-scroll-position-v1";

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [view, setView] = useState<ViewKey>("overview");
  const [operation, setOperation] = useState<OperationKey>("all");
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [dataset, setDataset] = useState<QualityDataset>(() => loadStoredDataset());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState("08:42 MYT");

  useEffect(() => {
    const restoreScrollPosition = () => {
      try {
        const storedPosition = Number(sessionStorage.getItem(SCROLL_POSITION_KEY));
        if (Number.isFinite(storedPosition) && storedPosition > 0) window.scrollTo({ top: storedPosition, behavior: "auto" });
      } catch { /* session storage may be unavailable in restricted browser contexts */ }
    };
    const saveScrollPosition = () => {
      try { sessionStorage.setItem(SCROLL_POSITION_KEY, String(Math.round(window.scrollY))); } catch { /* ignore unavailable storage */ }
    };
    window.history.scrollRestoration = "manual";
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(restoreScrollPosition));
    window.addEventListener("scroll", saveScrollPosition, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", saveScrollPosition);
    };
  }, []);

  const navigate = (next: ViewKey) => { setView(next); setMobileOpen(false); };
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    window.setTimeout(() => {
      setLastSync(`${new Intl.DateTimeFormat("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" }).format(new Date())} MYT`);
      setRefreshing(false);
    }, 500);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        <div className="brand"><div className="brand-mark"><ShieldCheck size={21} /></div><div><strong>{t("brand.name")}</strong><small>{t("brand.tagline")}</small></div></div>
        <div className="sidebar-label">{t("workspace")}</div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {(Object.keys(viewMeta) as ViewKey[]).map((key) => { const Icon = viewMeta[key].icon; return (
            <button key={key} className={view === key ? "active" : ""} type="button" onClick={() => navigate(key)}>
              <Icon size={18} /><span>{t(viewMeta[key].labelKey)}</span>{view === key ? <ChevronRight className="nav-caret" size={15} /> : null}
            </button>
          ); })}
        </nav>
        <div className="sidebar-label sidebar-label--lower">{t("activeData")}</div>
        <div className="sidebar-source"><span className="source-dot" /><span>{t("localDataset")}<small>{dataset.inspections.length} {t("inspectionRecords")}</small></span></div>
        <div className="sidebar-spacer" />
        <div className="sidebar-plant"><Factory size={17} /><div><strong>{t("plant")}</strong><small>{t("location")}</small></div></div>
      </aside>
      {mobileOpen ? <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} /> : null}

      <div className="main-shell">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Open menu" onClick={() => setMobileOpen((open) => !open)}><Menu size={20} /></button>
          <div className="breadcrumb"><Factory size={16} /><span>{t("plantQuality")}</span><ChevronRight size={14} /><strong>{t(viewMeta[view].labelKey)}</strong></div>
          <div className="topbar-actions"><span className="plant-status"><i /> {t("plant")} · {language === "zh" ? "吉隆坡" : "Kuala Lumpur"}</span><span className="sync-status">{t("synced")} {lastSync}</span><div className="language-switcher" role="group" aria-label="Language"><button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button><button type="button" className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")} aria-pressed={language === "zh"}>中文</button></div><button className={`refresh-button ${refreshing ? "is-refreshing" : ""}`} type="button" onClick={refresh} disabled={refreshing} aria-label={t("refresh")}><RefreshCw size={15} /><span>{refreshing ? t("refreshing") : t("refresh")}</span></button></div>
        </header>

        {view !== "data" && view !== "database" && view !== "governance" ? <div className="operation-bar" role="tablist" aria-label="Manufacturing operation">
          {(Object.keys(operationMeta) as OperationKey[]).map((key) => <button key={key} type="button" role="tab" aria-selected={operation === key} className={operation === key ? "active" : ""} onClick={() => setOperation(key)}><span>{operationMeta[key].shortLabel}</span>{operationLabel(key, language)}</button>)}
        </div> : null}

        <main className="content">
          <Suspense fallback={<div className="view-loading">Loading quality workspace...</div>}>
            {view === "overview" ? <ExecutiveOverview dataset={dataset} operation={operation} filters={filters} onFiltersChange={setFilters} onOpenExplorer={() => setView("explorer")} /> : null}
            {view === "explorer" ? <QualityExplorer dataset={dataset} operation={operation} filters={filters} onFiltersChange={setFilters} /> : null}
            {view === "data" ? <DataManager dataset={dataset} onDatasetChange={setDataset} /> : null}
            {view === "database" ? <DatabaseSettings /> : null}
            {view === "governance" ? <AuthorizationCenter /> : null}
          </Suspense>
        </main>
        <footer className="app-footer"><span>{t("footerDemo")}</span><span>{t("footerRolling")} <i /></span></footer>
      </div>
    </div>
  );
}
