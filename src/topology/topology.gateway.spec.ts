import { UserRole } from '../generated/prisma/enums';
import { TopologyGateway } from './topology.gateway';

describe('TopologyGateway', () => {
  const user = {
    id: 2,
    username: 'alice',
    email: 'alice@example.com',
    role: UserRole.USER,
  };

  function client(token: unknown = 'token') {
    return {
      id: 'socket-1',
      handshake: { auth: { token } },
      data: {},
      emit: jest.fn(() => true),
      disconnect: jest.fn(),
    };
  }

  it('authenticates a socket from the handshake auth token', async () => {
    const jwt = {
      verify: jest.fn().mockReturnValue({
        sub: 2,
        username: 'alice',
        email: 'alice@example.com',
        role: UserRole.USER,
      }),
    };
    const gateway = new TopologyGateway(jwt as any, {} as any, {} as any);
    const socket = client();

    await gateway.handleConnection(socket);

    expect(socket.data.user).toEqual(user);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects an unauthenticated socket', async () => {
    const gateway = new TopologyGateway({} as any, {} as any, {} as any);
    const socket = client(null);

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('does not subscribe to Redis before site access is authorized', async () => {
    const bus = {
      subscribe: jest.fn(),
    };
    const query = {
      getTopology: jest.fn().mockRejectedValue(new Error('not found')),
    };
    const gateway = new TopologyGateway({} as any, query as any, bus as any);
    const socket = client();
    socket.data.user = user;

    await gateway.subscribeToSite(socket, { siteId: 'foreign-site', revision: 3 });

    expect(bus.subscribe).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('topology.error', {
      message: 'Topology subscription is unavailable',
    });
  });

  it('subscribes to Redis and asks for resync when revisions differ', async () => {
    const stop = jest.fn().mockResolvedValue(undefined);
    const bus = {
      subscribe: jest.fn().mockResolvedValue(stop),
    };
    const query = {
      getTopology: jest.fn().mockResolvedValue({ revision: 5 }),
    };
    const gateway = new TopologyGateway({} as any, query as any, bus as any);
    const socket = client();
    socket.data.user = user;

    await gateway.subscribeToSite(socket, { siteId: 'site-2', revision: 3 });

    expect(bus.subscribe).toHaveBeenCalledWith('site-2', expect.any(Function));
    expect(socket.emit).toHaveBeenCalledWith(
      'topology.resync',
      expect.objectContaining({
        siteId: 'site-2',
        revision: 5,
        reason: 'revision-mismatch',
      }),
    );
    expect(socket.emit).toHaveBeenCalledWith('topology.ready', {
      siteId: 'site-2',
      revision: 5,
    });
  });
});
