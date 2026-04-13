/** Brand palette aligned with Hungry Tiger / table-order UI references */
export const Brand = {
  yellow: '#FCD200',
  yellowMuted: '#FFF9C4',
  black: '#111111',
  grey: '#757575',
  greyLight: '#F5F5F5',
  white: '#FFFFFF',
  /** Promo / accents (home reference) */
  redSmile: '#E53935',
  magenta: '#D81B60',
  pinkHot: '#FF6B9D',
  orangePromo: '#FF9800',
  loginBarBg: '#2C2C2C',
} as const;

const tintColorLight = Brand.yellow;
const tintColorDark = Brand.yellow;

export default {
  light: {
    text: Brand.black,
    background: Brand.white,
    tint: tintColorLight,
    tabIconDefault: '#BDBDBD',
    tabIconSelected: Brand.black,
  },
  dark: {
    text: '#fff',
    background: '#121212',
    tint: tintColorDark,
    tabIconDefault: '#666',
    tabIconSelected: Brand.yellow,
  },
};
