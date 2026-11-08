import { test } from '@playwright/test';

/** Static title, or one built from the decorated method's arguments. */
type StepTitle<Args extends unknown[]> = string | ((...args: Args) => string);

/**
 * Runs the decorated async method inside a boxed `test.step`, so that:
 *  - the step shows up in the HTML report and trace with a business-readable title;
 *  - a failure inside it is reported at the test line that called it.
 *
 * Title defaults to the method name.
 *
 *   @boxedStep('create order')
 *   @boxedStep((id: string) => `fetch order ${id}`)
 *
 * Based on the boxed-step decorator in the Playwright docs (TC39 standard decorators).
 */
export function boxedStep<TitleArgs extends unknown[]>(title?: StepTitle<TitleArgs>) {
  return function decorate<This, Args extends TitleArgs, Return>(
    target: (this: This, ...args: Args) => Promise<Return>,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
  ) {
    return async function boxedMethod(this: This, ...args: Args): Promise<Return> {
      const stepTitle = typeof title === 'function' ? title(...args) : (title ?? String(context.name));

      // `return await` is load-bearing: test.step captures the stack for the box AFTER an
      // internal await, so only async frames survive. Awaiting here keeps this frame and the
      // test's calling line in V8's async stack; returning the bare promise would drop them
      // and a failure would be reported with no location at all.
      return await test.step(stepTitle, () => target.apply(this, args), { box: true });
    };
  };
}
