import GraphQLJSON from "graphql-type-json";
import { GraphQLUpload } from "graphql-upload";

import { userQueries, userMutations } from './user';
import { gameQueries, gameMutations } from './game';
import { tournamentQueries, tournamentMutations } from './tournament';


const resolvers = {
    JSON: GraphQLJSON,
    Upload: GraphQLUpload,
    ResponseData: {
        __resolveType(obj: any, _: any, __: any) {
            if (obj.user && obj.token) return 'AuthPayload';
            if (obj.totalGamesPlayed !== undefined && obj.totalWins !== undefined) return 'UserStats';
            if (obj.tournaments) return 'TournamentList';
            if (obj.games) return 'GameList';
            if (obj.players !== undefined) return 'LeaderboardResult';
            if (obj.email) return 'User';
            if (obj.currentTurn || obj.tokens) return 'LudoGameState';
            if (obj.title) return 'Tournament';

            console.error('[GraphQL Union Resolver] Failed to resolve type for keys:', Object.keys(obj));
            return null;
        }
    },
    Query: {
        ...userQueries,
        ...gameQueries,
        ...tournamentQueries,
    },
    Mutation: {
        ...userMutations,
        ...gameMutations,
        ...tournamentMutations,
    }
}

export default resolvers;