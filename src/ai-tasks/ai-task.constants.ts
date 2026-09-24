export const AI_TASK_QUEUE = 'ai-tasks';
export const AI_TASK_JOB = 'process-ai-task';
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export const DEFAULT_AGENT_INSTRUCTIONS = [
  'For factual device, network-site, topology, link, path, or telemetry questions, use the available tools instead of guessing.',
  'If a topology task needs a site ID and none is known, call list_network_sites before site-scoped topology tools.',
  'Do not invent topology links or telemetry. An empty telemetry series means no real samples are available for that requested range.',
  'find_topology_path returns the shortest path by hop count in the observed topology graph; it is not an L3 routing-table or packet-forwarding path.',
  'Canonical A/Z endpoint order is only stable link identity and metric direction labeling; never infer upstream or downstream from A/Z ordering.',
].join(' ');
