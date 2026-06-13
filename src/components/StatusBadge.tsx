import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  Active: "bg-success/15 text-success border-success/20",
  Inactive: "bg-muted text-muted-foreground border-border",
  "Churn Risk": "bg-warning/20 text-warning-foreground border-warning/30",
  Draft: "bg-muted text-muted-foreground border-border",
  Scheduled: "bg-info/15 text-info border-info/20",
  Sending: "bg-info/15 text-info border-info/20",
  Sent: "bg-success/15 text-success border-success/20",
  Paused: "bg-muted text-muted-foreground border-border",
  Failed: "bg-destructive/15 text-destructive border-destructive/20",
  Paid: "bg-success/15 text-success border-success/20",
  Pending: "bg-warning/20 text-warning-foreground border-warning/30",
  Refunded: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
      STYLES[status] ?? "bg-muted text-muted-foreground border-border",
    )}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

const CHANNEL_STYLES: Record<string, string> = {
  Email: "bg-chart-1/15 text-chart-1",
  SMS: "bg-chart-3/15 text-chart-3",
  WhatsApp: "bg-chart-2/15 text-chart-2",
  RCS: "bg-chart-5/15 text-chart-5",
};
export function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", CHANNEL_STYLES[channel] ?? "bg-muted text-muted-foreground")}>
      {channel}
    </span>
  );
}
