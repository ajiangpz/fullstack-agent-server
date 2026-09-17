import { Card } from '@/components/ui/card';

export default function AuditPage() {
  return <div className="mx-auto max-w-6xl"><p className="text-sm text-cyan-400">MVP</p><h1 className="mt-1 text-3xl font-semibold">Audit Logs</h1><Card className="mt-6 p-6 text-sm leading-6 text-zinc-400">The console route is reserved for the existing audit domain. A paginated audit API is required before rendering production data.</Card></div>;
}
