import type { PrismaClient } from '../../generated/prisma/client.js';
import type { Config } from '../../config/env.js';
import { IdentityCrypto } from './identity.crypto.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';
import {
  UnconfiguredDelivery,
  type IdentityDelivery,
} from './identity.delivery.js';
export function createIdentity(
  config: Config,
  client: PrismaClient,
  delivery: IdentityDelivery = new UnconfiguredDelivery(),
) {
  return new IdentityService(
    new IdentityRepository(client),
    new IdentityCrypto(config),
    delivery,
  );
}
