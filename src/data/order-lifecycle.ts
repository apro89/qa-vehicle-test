import { ErrorCode } from '@/schemas/error.schema';
import { OrderStatus, OrderStatusSchema } from '@/schemas/order.schema';

/**
 * Consumer-side view of the order state machine (the business rule PATCH must enforce).
 * This is the single table that drives every lifecycle test: allowed transitions are
 * read from it, forbidden ones are derived as its complement, and set-up paths are
 * computed from it. Changing a business rule means changing one line here.
 *
 * Deliberately NOT shared with mock-server/ (see CLAUDE.md rule 5).
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
  [OrderStatus.IN_PRODUCTION]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

const ALL_STATUSES = OrderStatusSchema.options;

/** A status with no outgoing transition: the order is locked for ever. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ALL_STATUSES.filter(
  (status) => ALLOWED_TRANSITIONS[status].length === 0,
);

export type TransitionCase = {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
};

export type ForbiddenTransitionCase = TransitionCase & {
  /** Error code the API must return: a rule violation or a locked (terminal) order. */
  readonly code: ErrorCode;
};

/** Every edge of the state machine, one test each: PENDING → CONFIRMED, … (5 cases). */
export const allowedTransitions: readonly TransitionCase[] = ALL_STATUSES.flatMap((from) =>
  ALLOWED_TRANSITIONS[from].map((to) => ({ from, to })),
);

/**
 * Every transition the state machine does NOT list, for the statuses that still accept changes.
 * A "no-op" (same status) is not a transition and is left out.
 */
const skippedTransitions: readonly ForbiddenTransitionCase[] = ALL_STATUSES.filter(
  (from) => !TERMINAL_STATUSES.includes(from),
).flatMap((from) =>
  ALL_STATUSES.filter((to) => to !== from && !ALLOWED_TRANSITIONS[from].includes(to)).map(
    (to) => ({ from, to, code: ErrorCode.INVALID_STATUS_TRANSITION }),
  ),
);

/**
 * One representative "reopen" attempt per terminal status. The API answers ORDER_LOCKED for
 * any change to a terminal order, so one target per status proves the lock without
 * multiplying near-identical tests.
 */
const reopenAttempts: readonly ForbiddenTransitionCase[] = TERMINAL_STATUSES.map((from) => ({
  from,
  to: OrderStatus.PENDING,
  code: ErrorCode.ORDER_LOCKED,
}));

export const forbiddenTransitions: readonly ForbiddenTransitionCase[] = [
  ...skippedTransitions,
  ...reopenAttempts,
];

/**
 * Shortest sequence of statuses that takes a fresh (PENDING) order to `target`,
 * excluding the start. Used by OrderSteps to arrange an order in any status.
 *   pathTo('DELIVERED') → ['CONFIRMED', 'IN_PRODUCTION', 'DELIVERED']
 */
export function pathTo(target: OrderStatus, from: OrderStatus = OrderStatus.PENDING): OrderStatus[] {
  const queue: OrderStatus[][] = [[from]];
  const visited = new Set<OrderStatus>([from]);

  for (let path = queue.shift(); path; path = queue.shift()) {
    const current = path[path.length - 1] ?? from;
    if (current === target) return path.slice(1);

    for (const next of ALLOWED_TRANSITIONS[current]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }

  throw new Error(`Order status ${target} is not reachable from ${from}`);
}
