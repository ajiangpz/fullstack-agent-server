import { Card } from '@/components/ui/card';

export default function DevicesPage() {
  return <PhaseCard title="Devices" phase="Phase 2" description="Device list, filters, CRUD dialogs and device details will connect to the existing /devices API in the next milestone." />;
}

function PhaseCard({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-cyan-400">{phase}</p>
      <h1 className="mt-1 text-3xl font-semibold">{title}</h1>
      <Card className="mt-6 p-6 text-sm leading-6 text-zinc-400">{description}</Card>
    </div>
  );
}
