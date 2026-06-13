import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, ShoppingBag, Layers, Megaphone,
  BarChart3, Sparkles, Settings, ChevronLeft, ChevronRight,
  Radio, Lightbulb, Bot, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/import", label: "Import Data", icon: Upload },
  { to: "/segments", label: "Segments", icon: Layers },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/insights", label: "AI Insights", icon: Lightbulb },
  { to: "/agent", label: "Campaign Agent", icon: Bot },
  { to: "/copilot", label: "AI Copilot", icon: Sparkles },
  { to: "/simulator", label: "Channel Simulator", icon: Radio },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <aside
      className={cn(
        "relative shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">X</div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Xeno CRM</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Marketing</span>
          </div>
        )}
      </div>

      <nav className="p-2 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(to)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -right-3 top-16 h-6 w-6 rounded-full border bg-card shadow-sm hover:bg-accent"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>
    </aside>
  );
}
