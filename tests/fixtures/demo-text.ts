/**
 * Realistic multi-domain demo text input representative of user submissions to Afterfact:
 * - Pricing & fees domain (Stripe UK & US processing fees)
 * - AI capabilities & models domain (Claude 3.5 Sonnet context window)
 * - Cloud infrastructure limits domain (Vercel serverless execution timeout)
 */
export const DEMO_TEXT_INPUT = `Stripe charges a processing fee of 1.4% + 20p for standard UK cards. In the US, Stripe charges 2.9% + 30c for online credit card transactions.

Anthropic Claude Pro costs $20 per month and includes access to Claude 3.5 Sonnet. As of October 2024, Claude 3.5 Sonnet offers a 200,000 token context window.

On Vercel Hobby tier, serverless function execution is limited to a maximum of 10 seconds.`;

/**
 * Purely subjective opinion demo text with zero verifiable factual assertions.
 */
export const DEMO_SUBJECTIVE_INPUT = `I honestly feel that programming in TypeScript is remarkably satisfying, aesthetic, and enjoyable. It feels much more elegant than other alternatives.`;
