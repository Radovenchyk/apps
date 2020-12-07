// Copyright 2017-2020 @polkadot/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveParachainInfo } from '@polkadot/api-derive/types';
import type { TFunction } from 'i18next';

export function parachainName (t: TFunction, info: DeriveParachainInfo | null): string {
  return info?.name || t<string>('Unknown Chain');
}

export function parachainOwner (t: TFunction, info: DeriveParachainInfo | null): string {
  return info?.owner || t<string>('Unknown Owner');
}
