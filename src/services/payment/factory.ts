import { BachsSandboxProvider } from './bachs';
import { FlutterwaveSandboxProvider } from './flutterwave';
import { PaystackSandboxProvider } from './paystack';
import { PaymentProvider } from './types';

let currentProviderName = (process.env.PAYMENT_PROVIDER || 'paystack').toLowerCase();

const paystackProvider = new PaystackSandboxProvider();
const flutterwaveProvider = new FlutterwaveSandboxProvider();
const bachsProvider = new BachsSandboxProvider();

export function getPaymentProvider(providerName?: string): PaymentProvider {
  const selected = (providerName || currentProviderName).toLowerCase();
  if (selected === 'flutterwave') {
    return flutterwaveProvider;
  }
  if (selected === 'bachs' || selected === 'bachs.io') {
    return bachsProvider;
  }
  return paystackProvider;
}

export function setPaymentProviderDefault(providerName: 'paystack' | 'flutterwave' | 'bachs') {
  currentProviderName = providerName;
}

export function getCurrentProviderName(): string {
  return currentProviderName;
}

