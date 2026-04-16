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
  reviewCount: number;
  category: string;
  openHours: string;
  address: string;
  distance: string;
  isHalal?: boolean;
  tags: { label: string; tone: 'pink' | 'orange' }[];
  image: string;
  cta: string;
};

export type RestaurantMenuCategory = {
  id: string;
  label: string;
};

export type RestaurantMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  promoLabel?: string;
  badges: string[];
  bundleLabel?: string;
  soldText: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  image: string;
};

export type RestaurantDetail = {
  id: string;
  coverImage: string;
  galleryCount: number;
  menuCategories: RestaurantMenuCategory[];
  menuItems: RestaurantMenuItem[];
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
    reviewCount: 229,
    category: 'Fast Food',
    openHours: '10:00-22:00',
    address: 'Jl. Sultan Agung, RT.2/RW.8, Manggarai, Jakarta Selatan',
    distance: '332.8 km',
    isHalal: true,
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
    reviewCount: 512,
    category: 'Drinks',
    openHours: '09:00-23:00',
    address: 'PIK Avenue Ground Floor, Penjaringan, Jakarta Utara',
    distance: '318.5 km',
    tags: [{ label: 'Popular', tone: 'orange' }],
    image:
      'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80',
    cta: 'View deal',
  },
  {
    id: 'p3',
    title: 'Mao Jia Cai — Golf Island',
    rating: '4.6(189)',
    reviewCount: 189,
    category: 'Chinese',
    openHours: '11:00-21:30',
    address: 'Ruko Golf Island Blok B, Pantai Indah Kapuk, Jakarta Utara',
    distance: '320.2 km',
    tags: [{ label: 'Table order', tone: 'pink' }],
    image:
      'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&q=80',
    cta: 'Order here',
  },
];

export const RESTAURANT_DETAILS: Record<string, RestaurantDetail> = {
  p1: {
    id: 'p1',
    coverImage: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=1200&q=80',
    galleryCount: 9,
    menuCategories: [
      { id: 'all', label: 'All' },
      { id: 'single', label: 'Single Meal' },
      { id: 'duo', label: 'Duo Meal' },
      { id: 'family', label: 'Family Meal' },
    ],
    menuItems: [
      {
        id: 'k1',
        categoryId: 'single',
        name: 'Super Treat',
        promoLabel: 'New user price',
        badges: ['Refundable'],
        bundleLabel: '3-4 pax',
        soldText: '10K+ sold',
        price: 98000,
        originalPrice: 161502,
        discountPercent: 39,
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80',
      },
      {
        id: 'k2',
        categoryId: 'duo',
        name: 'Spicy Wings Duo',
        promoLabel: 'New user price',
        badges: ['Refundable'],
        bundleLabel: '2 pax',
        soldText: '10K+ sold',
        price: 48000,
        originalPrice: 95000,
        discountPercent: 49,
        image: 'https://images.unsplash.com/photo-1562967916-eb82221dfb36?w=500&q=80',
      },
      {
        id: 'k3',
        categoryId: 'family',
        name: 'Family Bucket',
        badges: ['Popular'],
        bundleLabel: '4-5 pax',
        soldText: '7K+ sold',
        price: 158000,
        originalPrice: 219000,
        discountPercent: 28,
        image: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=500&q=80',
      },
    ],
  },
  p2: {
    id: 'p2',
    coverImage: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=1200&q=80',
    galleryCount: 6,
    menuCategories: [
      { id: 'all', label: 'All' },
      { id: 'milk', label: 'Milk Tea' },
      { id: 'ice', label: 'Ice Cream' },
      { id: 'combo', label: 'Combo' },
    ],
    menuItems: [
      {
        id: 'm1',
        categoryId: 'milk',
        name: 'Brown Sugar Pearl Milk Tea',
        promoLabel: 'Limited offer',
        badges: ['Best Seller'],
        soldText: '12K+ sold',
        price: 22000,
        originalPrice: 28000,
        discountPercent: 22,
        image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=500&q=80',
      },
      {
        id: 'm2',
        categoryId: 'ice',
        name: 'Strawberry Sundae',
        badges: ['Refundable'],
        soldText: '8K+ sold',
        price: 16000,
        originalPrice: 20000,
        discountPercent: 20,
        image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&q=80',
      },
      {
        id: 'm3',
        categoryId: 'combo',
        name: 'Tea + Sundae Combo',
        badges: ['Popular'],
        soldText: '5K+ sold',
        price: 32000,
        originalPrice: 39000,
        discountPercent: 18,
        image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=500&q=80',
      },
    ],
  },
  p3: {
    id: 'p3',
    coverImage: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=1200&q=80',
    galleryCount: 7,
    menuCategories: [
      { id: 'all', label: 'All' },
      { id: 'spicy', label: 'Spicy Set' },
      { id: 'soup', label: 'Soup' },
      { id: 'group', label: 'Group Meal' },
    ],
    menuItems: [
      {
        id: 'c1',
        categoryId: 'spicy',
        name: 'Mala Beef Rice Bowl',
        promoLabel: 'Lunch promo',
        badges: ['Refundable'],
        soldText: '4K+ sold',
        price: 42000,
        originalPrice: 55000,
        discountPercent: 24,
        image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80',
      },
      {
        id: 'c2',
        categoryId: 'soup',
        name: 'Sichuan Soup Set',
        badges: ['Signature'],
        soldText: '2K+ sold',
        price: 58000,
        originalPrice: 74000,
        discountPercent: 22,
        image: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?w=500&q=80',
      },
      {
        id: 'c3',
        categoryId: 'group',
        name: 'Hotpot Duo',
        badges: ['Best for sharing'],
        bundleLabel: '2-3 pax',
        soldText: '3K+ sold',
        price: 88000,
        originalPrice: 112000,
        discountPercent: 21,
        image: 'https://images.unsplash.com/photo-1604908176997-4312f53adfa5?w=500&q=80',
      },
    ],
  },
};
