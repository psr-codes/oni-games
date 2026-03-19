// ── Centralized Game Image Registry ─────────────────────────────────────
// Maps game slug → banner image URL.
// Add new images here when ready — components will automatically use them.
// Games without an entry will fall back to the gradient + emoji style.

const BASE_URL =
  "https://raw.githubusercontent.com/psr-codes/images/main/onichan-fun";

export const GAME_IMAGES: Record<string, string> = {
  // Arcade Games
  tetris: `${BASE_URL}/games/1_tetris.svg`,
  "space-invaders": `${BASE_URL}/games/2_space_invaders.svg`,
  snake: `${BASE_URL}/games/3_neon_snake.svg`,
  "2048": `${BASE_URL}/games/4_2048.svg`,
  "bubble-pop": `${BASE_URL}/games/5_bubble_pop.svg`,
  "doodle-jump": `${BASE_URL}/games/6_doodle_jump.svg`,
  "tower-bloxx": `${BASE_URL}/games/7_tower_bloxx.svg`,

  // Casino Games
  "coin-flip": `${BASE_URL}/casino/casino_1_coin_flip.svg`,
  "hash-roulette": `${BASE_URL}/casino/casino_2_hash_roulette.svg`,
  "dice-roll": `${BASE_URL}/casino/casino_3_dice_roll.svg`,
  "color-prediction": `${BASE_URL}/casino/casino_4_color_prediction.svg`,
  "wheel-of-fortune": `${BASE_URL}/casino/casino_5_wheel_of_fortune.svg`,
  crash: `${BASE_URL}/casino/casino_6_crypto_crash.svg`,
  "treasure-hunt": `${BASE_URL}/casino/casino_7_treasure_hunt.svg`,
  highlow: `${BASE_URL}/casino/casino_8_high_low.svg`,
  "poly-dash": `${BASE_URL}/casino/casino_9_poly_dash.svg`,
  
  
};
