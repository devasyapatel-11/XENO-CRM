import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  return (
    <AppShell title="Settings">
      <PageContainer>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card title="Workspace">
              <Field label="Brand name" defaultValue="Xeno CRM" />
              <Field label="Support email" defaultValue="hello@xeno.shop" />
              <Field label="Default currency" defaultValue="INR (₹)" disabled />
            </Card>

            <Card title="AI Copilot">
              <Toggle label="Use real-time CRM data" desc="Allow Copilot to query your customer, order, and campaign tables." defaultChecked />
              <Toggle label="Show tool usage" desc="Display when Copilot calls a data tool to ground its answer." defaultChecked />
              <Toggle label="Personalization" desc="Use {{name}} and other tokens automatically in generated copy." defaultChecked />
            </Card>

            <Card title="Channels">
              <Field label="WhatsApp Business ID" placeholder="Connect WhatsApp" />
              <Field label="SMS Sender ID" placeholder="XENOSP" />
              <Field label="Email From Address" placeholder="hello@xeno.shop" />
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Plan">
              <div className="text-2xl font-semibold">Growth</div>
              <p className="text-sm text-muted-foreground">20,000 contacts • Unlimited campaigns</p>
              <Button variant="outline" size="sm">Manage plan</Button>
            </Card>
            <Card title="Danger Zone">
              <Button variant="destructive" size="sm">Reset demo data</Button>
            </Card>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border bg-card">
    <div className="px-5 py-3 border-b"><h3 className="text-sm font-semibold">{title}</h3></div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);
const Field = ({ label, ...rest }: { label: string } & React.ComponentProps<typeof Input>) => (
  <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">{label}</label><Input {...rest} /></div>
);
const Toggle = ({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) => (
  <div className="flex items-start justify-between gap-4">
    <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
    <Switch defaultChecked={defaultChecked} />
  </div>
);
