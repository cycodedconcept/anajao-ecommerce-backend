import type { Database } from '../../database/client.js';
export class HealthService {
  constructor(
    private readonly database: Database,
    private readonly isShuttingDown: () => boolean,
  ) {}
  health() {
    return { status: 'ok' };
  }
  async ready() {
    if (this.isShuttingDown()) return false;
    try {
      await this.database.ping();
      return !this.isShuttingDown();
    } catch {
      return false;
    }
  }
}
