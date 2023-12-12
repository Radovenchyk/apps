import {
  decodeAddress,
  encodeAddress,
  validateAddress,
} from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';

import { HYDRADX_SS58_PREFIX } from '@galacticcouncil/sdk';

import { Buffer } from 'buffer';

const ETH_PREFIX = 'ETH\0';

export const EVM_PROVIDERS = ['metamask'];

export function convertAddressSS58(
  address: string,
  ss58prefix = HYDRADX_SS58_PREFIX,
): string {
  try {
    return encodeAddress(decodeAddress(address), ss58prefix);
  } catch {
    return null;
  }
}

export function convertFromH160(
  evmAddress: string,
  ss58prefix = HYDRADX_SS58_PREFIX,
) {
  const addressBytes = Buffer.from(evmAddress.slice(2), 'hex');
  const prefixBytes = Buffer.from(ETH_PREFIX);
  return encodeAddress(
    new Uint8Array(Buffer.concat([prefixBytes, addressBytes, Buffer.alloc(8)])),
    ss58prefix,
  );
}

export function convertToH160(address: string) {
  const decodedBytes = decodeAddress(address);
  const prefixBytes = Buffer.from(ETH_PREFIX);
  const addressBytes = decodedBytes.slice(prefixBytes.length, -8);
  return '0x' + Buffer.from(addressBytes).toString('hex');
}

export function convertToHex(address: string): string {
  try {
    return u8aToHex(decodeAddress(address));
  } catch {
    return null;
  }
}

export function isSameAddress(address1: string, address2: string): boolean {
  try {
    const decodedAddress1 = decodeAddress(address1)?.toString();
    const decodedAddress2 = decodeAddress(address2)?.toString();
    return decodedAddress1 === decodedAddress2;
  } catch {
    return false;
  }
}

export function isValidAddress(address: string): boolean {
  try {
    return address && validateAddress(address);
  } catch {
    return false;
  }
}

export function isEthAddress(address: string) {
  return address.length === 42 && address.startsWith('0x');
}
