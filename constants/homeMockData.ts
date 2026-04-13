export type HomeCategory = {
  id: string;
  label: string;
  icon: 'cup' | 'food' | 'store' | 'gamepad' | 'gift';
};

export type HomeBanner = {
  id: string;
  variant: 'coupon' | 'flash' | 'brands';
};

export type NearbyPromo = {
  id: string;
  title: string;
  rating: string;
  category: string;
  tags: { label: string; tone: 'pink' | 'orange' }[];
  image: string;
  cta: string;
};

export const HOME_CATEGORIES: HomeCategory[] = [
  { id: '1', label: 'Drinks', icon: 'cup' },
  { id: '2', label: 'Food', icon: 'food' },
  { id: '3', label: 'Retail', icon: 'store' },
  { id: '4', label: 'Game Zone', icon: 'gamepad' },
  { id: '5', label: 'Rewards', icon: 'gift' },
];

export const HOME_BANNERS: HomeBanner[] = [
  { id: 'b1', variant: 'coupon' },
  { id: 'b2', variant: 'flash' },
  { id: 'b3', variant: 'brands' },
];

export const NEARBY_PROMOS: NearbyPromo[] = [
  {
    id: 'p1',
    title: 'KFC — Pasaraya Manggarai',
    rating: '4.4(234)',
    category: 'Fast Food',
    tags: [
      { label: 'New User', tone: 'pink' },
      { label: '10K+ Sold', tone: 'orange' },
    ],
    image:
      'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&q=80',
    cta: 'View deal',
  },
  {
    id: 'p2',
    title: 'Mixue — PIK Avenue',
    rating: '4.7(512)',
    category: 'Drinks',
    tags: [{ label: 'Popular', tone: 'orange' }],
    image:
      'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80',
    cta: 'View deal',
  },
  {
    id: 'p3',
    title: 'Mao Jia Cai — Golf Island',
    rating: '4.6(189)',
    category: 'Chinese',
    tags: [{ label: 'Table order', tone: 'pink' }],
    image:
      'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&q=80',
    cta: 'Order here',
  },
];
