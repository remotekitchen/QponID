import { createSlice } from '@reduxjs/toolkit';

import type { GrouponDealDetail } from '@/store/grouponApi';

/** POST /buy or GET payment-status payload — keep loose for API evolution */
export type GrouponPurchasePayload = Record<string, unknown> | null;

type GrouponPurchaseState = {
  purchase: GrouponPurchasePayload;
  deal: GrouponDealDetail | null;
};

const initialState: GrouponPurchaseState = {
  purchase: null,
  deal: null,
};

const grouponPurchaseSlice = createSlice({
  name: 'grouponPurchase',
  initialState,
  reducers: {
    setGrouponPurchase(
      state,
      action: { payload: { purchase: GrouponPurchasePayload; deal?: GrouponDealDetail | null } }
    ) {
      state.purchase = action.payload.purchase;
      if (action.payload.deal !== undefined) state.deal = action.payload.deal;
    },
    clearGrouponPurchase(state) {
      state.purchase = null;
      state.deal = null;
    },
  },
});

export const { setGrouponPurchase, clearGrouponPurchase } = grouponPurchaseSlice.actions;
export default grouponPurchaseSlice.reducer;
