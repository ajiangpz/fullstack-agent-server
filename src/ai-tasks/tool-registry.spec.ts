import { NotFoundException } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import { GetDeviceTool } from './tools/get-device.tool';
import { ListDevicePortsTool } from './tools/list-device-ports.tool';
import { ListDevicesTool } from './tools/list-devices.tool';
import { SearchDevicesTool } from './tools/search-devices.tool';
import { ToolRegistry } from './tool-registry';

describe('ToolRegistry', () => {
  const devicesService = {} as DevicesService;
  const getDeviceTool = new GetDeviceTool(devicesService);
  const listDevicePortsTool = new ListDevicePortsTool(devicesService);
  const listDevicesTool = new ListDevicesTool(devicesService);
  const searchDevicesTool = new SearchDevicesTool(devicesService);
  const registry = new ToolRegistry(
    getDeviceTool,
    listDevicePortsTool,
    listDevicesTool,
    searchDevicesTool,
  );

  it('gets registered tools by name', () => {
    expect(registry.get('get_device')).toBe(getDeviceTool);
    expect(registry.get('list_device_ports')).toBe(listDevicePortsTool);
    expect(registry.get('list_devices')).toBe(listDevicesTool);
    expect(registry.get('search_devices')).toBe(searchDevicesTool);
  });

  it('lists registered tools', () => {
    expect(registry.list()).toEqual([
      getDeviceTool,
      listDevicePortsTool,
      listDevicesTool,
      searchDevicesTool,
    ]);
  });

  it('rejects unknown tools', () => {
    expect(() => registry.get('unknown')).toThrow(
      new NotFoundException('Unknown tool: unknown'),
    );
  });
});
