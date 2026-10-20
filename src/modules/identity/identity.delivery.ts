import { AppError } from '../../common/errors/app-error.js';
export interface DeliveryMessage {
  destination: string;
  purpose: 'EMAIL' | 'PHONE' | 'PASSWORD_RESET';
  token: string;
}
export interface IdentityDelivery {
  assertAvailable(channel: 'email' | 'sms'): void;
  send(message: DeliveryMessage): Promise<void>;
}
// Production fails closed until a verified delivery adapter is explicitly wired.
export class UnconfiguredDelivery implements IdentityDelivery {
  assertAvailable(): never {
    throw new AppError(
      503,
      'DELIVERY_UNAVAILABLE',
      'Delivery provider is not configured',
    );
  }
  async send(): Promise<void> {
    this.assertAvailable();
  }
}
// Test adapter only: never mounted by the server and never exposes tokens over HTTP.
export class MemoryDelivery implements IdentityDelivery {
  readonly messages: DeliveryMessage[] = [];
  assertAvailable(): void {}
  async send(message: DeliveryMessage): Promise<void> {
    this.messages.push(message);
  }
}
