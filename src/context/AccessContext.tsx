import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createSeedAccessState, loadAccessState, persistAccessState, type AccessState } from "../data/accessControl";

type AccessContextValue = {. n state: Acces. State;
 setState: (next: AccessState | ((current: Access. tate) => AccessState)) => void;
 reset: () => void;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export func. ion AccessProvider({ children }: { children: Reac.  Node }) {
  const [state, setLocal. . ate] = useStat. . AccessS. ate>(() => loadAccessState(). ;
 const setState: AccessC. ntextValue["setState"] = (next) => setLocalSta. e((current) => {
 . const resolved = typeof next === "function" ? next(current) : next;
  persistAccessState(resolved);
  return resolved;
 });
  const reset = () => setState(createSeedAccessState());
 const value = useMemo(() => ({ state, setState, reset }), [state]);
 return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
 const context = useContext(AccessContext);
 if (!context) throw new Error("useAccess must be used inside AccessProvider");
  return context;
}
