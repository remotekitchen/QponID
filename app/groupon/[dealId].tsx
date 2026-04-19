import { useLocalSearchParams } from 'expo-router';

import GrouponDealDetailScreen from '@/components/groupon/GrouponDealDetailScreen';

/** Groupon detail — loads `GET .../api/groupon/v1/deals/:dealId` */
export default function GrouponDealRoute() {
  const params = useLocalSearchParams<{ dealId: string | string[] }>();
  const raw = params.dealId;
  const dealId = Array.isArray(raw) ? raw[0] : raw;

  return <GrouponDealDetailScreen dealId={dealId ? String(dealId) : ''} />;
}
