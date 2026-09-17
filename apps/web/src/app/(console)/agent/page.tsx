import { Card } from '@/components/ui/card';

export default function AgentPage() {
  return <Placeholder title="AI Agent" phase="Phase 3" description="Prompt submission, AI task creation and polling will be implemented after device management." />;
}

function Placeholder({ title, phase, description }: { title: string; phase: string; description: string }) {
  return <div className="mx-auto max-w-6xl"><p className="text-sm text-cyan-400">{phase}</p><h1 className="mt-1 text-3xl font-semibold">{title}</h1><Card className="mt-6 p-6 text-sm leading-6 text-zinc-400">{description}</Card></div>;
}
