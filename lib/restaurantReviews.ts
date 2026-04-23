import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredRestaurantReview = {
  id: string;
  restaurantId: string;
  restaurantTitle: string;
  userId: string;
  userPhone: string | null;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

const REVIEW_STORAGE_PREFIX = 'restaurant_reviews_';

function reviewKey(restaurantId: string) {
  return `${REVIEW_STORAGE_PREFIX}${restaurantId}`;
}

export async function getRestaurantReviews(restaurantId: string): Promise<StoredRestaurantReview[]> {
  try {
    const raw = await AsyncStorage.getItem(reviewKey(restaurantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRestaurantReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addRestaurantReview(review: StoredRestaurantReview): Promise<StoredRestaurantReview[]> {
  const current = await getRestaurantReviews(review.restaurantId);
  const updated = [review, ...current];
  await AsyncStorage.setItem(reviewKey(review.restaurantId), JSON.stringify(updated));
  return updated;
}

export async function getReviewsByUser(userId: string, userPhone?: string | null): Promise<StoredRestaurantReview[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const reviewKeys = keys.filter((key) => key.startsWith(REVIEW_STORAGE_PREFIX));
    if (reviewKeys.length === 0) return [];

    const pairs = await AsyncStorage.multiGet(reviewKeys);
    const allReviews = pairs.flatMap(([, raw]) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as StoredRestaurantReview[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    });

    const normalizedPhone = (userPhone ?? '').trim();
    return allReviews
      .filter((review) => {
        if (review.userId === userId) return true;
        if (!normalizedPhone || !review.userPhone) return false;
        return review.userPhone.trim() === normalizedPhone;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}
