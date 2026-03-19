Dice Roll (Blocked / On Hold)
Needs Smart Contract Upgrade
Context: Current play_instant_wager function only supports exact match (guess == result). Dice Roll requires Over/Under logic (guess > result), which requires a new contract function to process properly.
Create
/casino/dice-roll/page.tsx
using the provided React template
Connect play_dice_wager to the dice roll logic (1-100 game_range)
Ensure dynamic houseEdgeBps and displayMultiplier calculations
Update
/casino/page.tsx
to list Dice Roll as a live game

Color Prediction (Blocked / On Hold)
Needs Smart Contract Upgrade
Context: Current play_instant_wager function only supports exact match (guess == result). Color Prediction requires weighted range probabilities (e.g. Red is 45% = numbers 0-44). The contract needs a new function to process weighted range wagers properly.
Create /casino/color-prediction/page.tsx using the template
Connect new contract function to process the roll
Ensure dynamic houseEdgeBps scales the payouts properly
