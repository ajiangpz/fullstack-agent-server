import { NotFoundException } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import { GetDeviceTool } from './tools/get-device.tool';
import { ToolRegistry } from './tool-registry';

describe('ToolRegistry', () => {
  const getDeviceTool = new GetDeviceTool({} as DevicesService);
  const registry = new ToolRegistry(getDeviceTool);

  it('gets a registered tool by name', () => {
    expect(registry.get('get_device')).toBe(getDeviceTool);
  });

  it('lists registered tools', () => {
    expect(registry.list()).toEqual([getDeviceTool]);
  });

  it('rejects unknown tools', () => {
    expect(() => registry.get('unknown')).toThrow(
      new NotFoundException('Unknown tool: unknown'),
    );
  });
});
