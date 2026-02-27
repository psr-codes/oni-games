"use client";

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-gray-950 py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">🏆 Leaderboard</h1>
          <p className="text-gray-400 text-lg">
            Top scores across all games, recorded on-chain forever.
          </p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
          <div className="text-5xl mb-4">🏗️</div>
          <h2 className="text-xl font-bold text-white mb-2">Coming Soon</h2>
          <p className="text-gray-500">
            On-chain leaderboards will appear here once games are playable.
            <br />
            Top 10 scores per game, stored immutably on OneChain.
          </p>
        </div>
      </div>
    </div>
  );
}
