import type { RawPayload } from '@/api/orders.client';
import { buildCreateOrderPayload } from './order.factory';

export type InvalidPayloadCase = {
  /** Reads naturally after "rejects the order when …". */
  readonly title: string;
  /** Dotted path the API must report in `error.details[].field`. */
  readonly invalidField: string;
  /** Lazily built so each test gets fresh, isolated data. */
  readonly build: () => RawPayload;
};

/** Representative equivalence class: format. */
export const invalidCreateOrderCases: readonly InvalidPayloadCase[] = [
  {
    title: 'the VIN is shorter than 17 characters',
    invalidField: 'vehicle.vin',
    build: () => buildCreateOrderPayload({ vehicle: { vin: 'WVWZZZ1JZXW00000' } }),
  },
];
