import { faker } from '@faker-js/faker';

export type UnauthenticatedCase = {
  /** Reads naturally after "returns 401 when …". */
  readonly title: string;
  /** Bearer token to send; undefined means no Authorization header at all. */
  readonly token: () => string | undefined;
};

export const unauthenticatedCallers: readonly UnauthenticatedCase[] = [
  {
    title: 'no bearer token is sent',
    token: () => undefined,
  },
  {
    title: 'the bearer token is not recognised',
    token: () => faker.string.alphanumeric(32),
  },
];
