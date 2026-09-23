import { canonicalizeTopologyLink } from './topology-link-key';

describe('canonicalizeTopologyLink', () => {
  it('orders endpoints by device ID so A-B and B-A share one key', () => {
    const forward = canonicalizeTopologyLink(
      { deviceId: 2, portId: 20 },
      { deviceId: 5, portId: 50 },
    );
    const reverse = canonicalizeTopologyLink(
      { deviceId: 5, portId: 50 },
      { deviceId: 2, portId: 20 },
    );

    expect(forward).toEqual(reverse);
    expect(forward.canonicalKey).toBe(
      'device:2:port:20--device:5:port:50',
    );
  });

  it('uses a stable placeholder when a port is unknown', () => {
    expect(
      canonicalizeTopologyLink(
        { deviceId: 3 },
        { deviceId: 8, portId: 9 },
      ).canonicalKey,
    ).toBe('device:3:port:*--device:8:port:9');
  });

  it('rejects self links', () => {
    expect(() =>
      canonicalizeTopologyLink(
        { deviceId: 4, portId: 1 },
        { deviceId: 4, portId: 2 },
      ),
    ).toThrow('Topology links must connect two different devices');
  });
});
