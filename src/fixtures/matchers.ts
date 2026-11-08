import { expect as baseExpect, type APIResponse } from '@playwright/test';
import { z } from 'zod';

const MAX_BODY_PREVIEW = 2_000;

async function previewBody(response: APIResponse): Promise<string> {
  try {
    const text = await response.text();
    return text.length > MAX_BODY_PREVIEW ? `${text.slice(0, MAX_BODY_PREVIEW)}…` : text || '<empty>';
  } catch {
    return '<unreadable body>';
  }
}

/**
 * Domain-specific matchers. Failure messages carry the URL and response body,
 * so a red test explains itself without opening the trace.
 */
export const expect = baseExpect.extend({
  async toHaveStatus(response: APIResponse, expected: number) {
    const actual = response.status();
    const pass = actual === expected;
    const body = pass === this.isNot ? await previewBody(response) : '';

    return {
      pass,
      name: 'toHaveStatus',
      expected,
      actual,
      message: () =>
        [
          this.utils.matcherHint('toHaveStatus', undefined, undefined, { isNot: this.isNot }),
          '',
          `Expected status: ${this.isNot ? 'not ' : ''}${this.utils.printExpected(expected)}`,
          `Received status: ${this.utils.printReceived(actual)}`,
          `URL:  ${response.url()}`,
          `Body: ${body}`,
        ].join('\n'),
    };
  },

  toMatchSchema(received: unknown, schema: z.ZodType) {
    const result = schema.safeParse(received);

    return {
      pass: result.success,
      name: 'toMatchSchema',
      message: () =>
        result.success
          ? 'Expected payload NOT to match the schema, but it did'
          : [
              this.utils.matcherHint('toMatchSchema', undefined, undefined, { isNot: this.isNot }),
              '',
              'Contract violation:',
              z.prettifyError(result.error),
              '',
              `Received: ${JSON.stringify(received, null, 2)}`,
            ].join('\n'),
    };
  },
});
