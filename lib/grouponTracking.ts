import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getDeviceId } from '@/lib/register';
import type { GrouponFunnelPayload, GrouponFunnelStep } from '@/store/grouponFunnelApi';

type FunnelArgs = {
  step: GrouponFunnelStep;
  sessionId?: string;
  restaurantId?: number;
  dealId?: number;
  voucherCode?: string;
  orderId?: number;
  meta?: Record<string, unknown>;
};

let sessionIdCache: string | null = null;

function getSessionId() {
  if (sessionIdCache) return sessionIdCache;
  sessionIdCache = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return sessionIdCache;
}

export async function buildGrouponFunnelPayload(args: FunnelArgs): Promise<GrouponFunnelPayload> {
  const payload: GrouponFunnelPayload = {
    step: args.step,
    device_id: await getDeviceId(),
    session_id: args.sessionId || getSessionId(),
    meta: {
      platform: Platform.OS,
      app_version:
        Constants.expoConfig?.version || Constants.nativeAppVersion || undefined,
      ...(args.meta || {}),
    },
  };

  if (typeof args.restaurantId === 'number') payload.restaurant_id = args.restaurantId;
  if (typeof args.dealId === 'number') payload.deal_id = args.dealId;
  if (typeof args.orderId === 'number') payload.order_id = args.orderId;
  if (args.voucherCode) payload.voucher_code = args.voucherCode;

  return payload;
}
