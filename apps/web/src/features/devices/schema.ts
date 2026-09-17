import { z } from 'zod';

function isIpv4(value: string) {
  const parts = value.split('.');
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part.startsWith('0')) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

export const deviceSchema = z.object({
  name: z.string().trim().min(1, 'Device name is required').max(100),
  ip: z.string().trim().refine(isIpv4, 'Enter a valid IPv4 address'),
  portCount: z.number().int().min(1).max(128),
  status: z.enum(['online', 'offline']),
});

export type DeviceFormValues = z.infer<typeof deviceSchema>;
