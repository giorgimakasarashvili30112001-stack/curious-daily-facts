import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen page-grain pb-24">
      <div className="mx-auto max-w-md px-5 space-y-3">{children}</div>
      <BottomNav />
    </div>
  );
}
