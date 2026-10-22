import { z } from 'zod';
import type { Scenario } from './scenarios.js';
const rawReport = z.object({
  run: z.object({
    executions: z.array(
      z.object({
        item: z.object({ name: z.string() }),
        response: z.object({ code: z.number().int() }).optional(),
        assertions: z
          .array(
            z.object({
              assertion: z.string(),
              skipped: z.boolean().optional(),
              error: z.unknown().optional(),
            }),
          )
          .optional(),
        requestError: z.unknown().optional(),
      }),
    ),
    failures: z.array(z.unknown()).optional(),
  }),
});
export interface RequestResult {
  name: string;
  executed: boolean;
  expectedStatus: number;
  actualStatus: number | null;
  passed: boolean;
  assertionsPassed: number;
  assertionsFailed: number;
  assertionsSkipped: number;
}
export function sanitizeReport(
  raw: unknown,
  expected: Scenario[],
): { requests: RequestResult[]; unexpectedFailure: boolean } {
  const parsed = rawReport.parse(raw);
  const executions = parsed.run.executions;
  const requests = expected.map((scenario): RequestResult => {
    const matches = executions.filter((e) => e.item.name === scenario.name);
    const entry = matches[0];
    const assertions = entry?.assertions ?? [];
    const passed = assertions.filter((a) => !a.skipped && !a.error).length;
    const failed = assertions.filter((a) => !a.skipped && !!a.error).length;
    const skipped = assertions.filter((a) => a.skipped).length;
    return {
      name: scenario.name,
      executed: matches.length > 0,
      expectedStatus: scenario.status,
      actualStatus: entry?.response?.code ?? null,
      passed:
        matches.length === 1 &&
        !entry?.requestError &&
        entry?.response?.code === scenario.status &&
        passed >= 3 &&
        failed === 0 &&
        skipped === 0,
      assertionsPassed: passed,
      assertionsFailed: failed,
      assertionsSkipped: skipped,
    };
  });
  return {
    requests,
    unexpectedFailure:
      executions.length !== expected.length ||
      (parsed.run.failures?.length ?? 0) > 0,
  };
}
export function reportMarkdown(report: {
  runner: string;
  runnerVersion: string;
  generatedAt: string;
  passed: boolean;
  requests: RequestResult[];
  sideEffects: { name: string; passed: boolean }[];
  cleanupPassed: boolean | null;
  failureStage: string | null;
}) {
  return `# API collection execution report\n\nGenerated: ${report.generatedAt}. Runner: ${report.runner} ${report.runnerVersion}. Overall: ${report.passed ? 'PASS' : 'FAIL'}.\n\nRequests: ${report.requests.filter((r) => r.passed).length} passed, ${report.requests.filter((r) => r.executed && !r.passed).length} failed, ${report.requests.filter((r) => !r.executed).length} not executed. Assertions: ${report.requests.reduce((n, r) => n + r.assertionsPassed, 0)} passed, ${report.requests.reduce((n, r) => n + r.assertionsFailed, 0)} failed, ${report.requests.reduce((n, r) => n + r.assertionsSkipped, 0)} skipped. Fixture cleanup: ${report.cleanupPassed === null ? 'NOT NEEDED (no fixtures created)' : report.cleanupPassed ? 'PASS' : 'FAIL'}.\n\n${report.failureStage ? `Failure stage: ${report.failureStage}. Sensitive error details were deliberately omitted.\n\n` : ''}| Request | Expected | Actual | Result |\n| --- | --- | --- | --- |\n${report.requests.map((r) => `| ${r.name} | ${r.expectedStatus} | ${r.actualStatus ?? 'not executed'} | ${!r.executed ? 'NOT EXECUTED' : r.passed ? 'PASS' : 'FAIL'} |`).join('\n')}\n\n## Database side effects\n\n${report.sideEffects.map((c) => `- ${c.name}: ${c.passed ? 'PASS' : 'FAIL'}`).join('\n')}\n\nThis report contains only allowlisted names, status codes and counts. No request/response bodies, tokens, passwords, emails, headers or raw errors are retained. Provider-success examples use an injected test delivery adapter; live email/SMS, Google/Apple success and cloud publishing were not executed. See postman/README.md for manual/setup requirements.\n`;
}
