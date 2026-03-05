import User from "../../../models/user/user";
import ClientResponse from "../../../services/response";

interface LeaderboardInput {
    limit?: number;
    page?: number;
    search?: string; // Search term for firstName, lastName, or userName
}

export default class LeaderboardService {
    /**
     * Get leaderboard ranked by win percentage (wins / totalGamesPlayed)
     * With offset-based pagination and search functionality
     */
    static async getLeaderboard({ limit = 20, page = 1, search }: LeaderboardInput) {
        try {
            const skip = (page - 1) * limit;

            // Build match conditions
            const matchConditions: any = {
                totalGamesPlayed: { $gt: 0 }
            };

            // Add search filter if provided
            if (search && search.trim()) {
                const searchRegex = { $regex: search.trim(), $options: 'i' };
                matchConditions.$or = [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { userName: searchRegex }
                ];
            }

            // Build aggregation pipeline
            const pipeline: any[] = [
                // Match users with games played (and optional search)
                { $match: matchConditions },
                // Calculate win percentage and weighted score
                {
                    $addFields: {
                        winPercentage: {
                            $cond: [
                                { $eq: ["$totalGamesPlayed", 0] },
                                0,
                                {
                                    $multiply: [
                                        { $divide: ["$totalWins", "$totalGamesPlayed"] },
                                        100
                                    ]
                                }
                            ]
                        },
                        // Bayesian Average: (Wins + K*C) / (TotalGames + K)
                        // K = 20 (Confidence weight), C = 0.5 (Prior probability)
                        weightedScore: {
                            $divide: [
                                { $add: ["$totalWins", 10] }, // 10 = 20 * 0.5
                                { $add: ["$totalGamesPlayed", 20] }
                            ]
                        }
                    }
                },
                // Sort by weighted Score (desc)
                {
                    $sort: {
                        weightedScore: -1,
                        winPercentage: -1,
                        totalWins: -1,
                        _id: 1
                    }
                },
                // Skip for pagination
                { $skip: skip },
                // Limit results
                { $limit: limit },
                // Project only needed fields
                {
                    $project: {
                        _id: 1,
                        userName: 1,
                        firstName: 1,
                        lastName: 1,
                        avatar: 1,
                        totalGamesPlayed: 1,
                        totalWins: 1,
                        totalLosses: 1,
                        currentStreak: 1,
                        bestStreak: 1,
                        winPercentage: 1,
                        weightedScore: 1
                    }
                }
            ];

            // Get total count for pagination info
            const countPipeline = [
                { $match: matchConditions },
                { $count: "total" }
            ];

            const [results, countResult] = await Promise.all([
                User.aggregate(pipeline),
                User.aggregate(countPipeline)
            ]);

            const total = countResult[0]?.total || 0;
            const totalPages = Math.ceil(total / limit);

            return new ClientResponse(200, true, 'Leaderboard fetched successfully', {
                players: results,
                total,
                page,
                limit,
                totalPages,
                hasMore: page < totalPages
            });
        } catch (error: any) {
            console.error('Error fetching leaderboard:', error);
            throw new Error(error.message);
        }
    }
}

