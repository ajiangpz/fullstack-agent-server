export interface TopologyLinkEndpoint {
  deviceId: number;
  portId?: number | null;
}

export interface CanonicalTopologyLinkEndpoints {
  a: TopologyLinkEndpoint;
  z: TopologyLinkEndpoint;
  canonicalKey: string;
}

export function canonicalizeTopologyLink(
  left: TopologyLinkEndpoint,
  right: TopologyLinkEndpoint,
): CanonicalTopologyLinkEndpoints {
  if (left.deviceId === right.deviceId) {
    throw new Error('Topology links must connect two different devices');
  }

  const [a, z] =
    left.deviceId < right.deviceId ? [left, right] : [right, left];

  return {
    a,
    z,
    canonicalKey: buildEndpointKey(a) + '--' + buildEndpointKey(z),
  };
}

function buildEndpointKey(endpoint: TopologyLinkEndpoint): string {
  return (
    'device:' +
    endpoint.deviceId +
    ':port:' +
    (endpoint.portId === null || endpoint.portId === undefined
      ? '*'
      : endpoint.portId)
  );
}
