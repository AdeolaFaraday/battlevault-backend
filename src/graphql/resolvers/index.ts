import GraphQLJSON from "graphql-type-json";
import { GraphQLUpload } from "graphql-upload";

import { userQueries, userMutations } from './user';
import { gameQueries, gameMutations } from './game';
import { tournamentQueries, tournamentMutations } from './tournament';
import { walletMutations, walletQueries } from './wallet';
import { uploadMutations } from './upload';


const resolvers = {
    JSON: GraphQLJSON,
    Upload: GraphQLUpload,
    ResponseData: {
        __resolveType(obj: any, _: any, __: any) {
            if (obj.user && (obj.token || 'experiencePoints' in obj.user)) return 'AuthPayload';
            if (obj.totalGamesPlayed !== undefined && obj.totalWins !== undefined) return 'UserStats';
            if (obj.tournaments) return 'TournamentList';
            if (obj.games) return 'GameList';
            if (obj.tokens) return 'LudoGameState';
            if (obj.players !== undefined) return 'LeaderboardResult';
            if (obj.email) return 'User';
            if (obj.title) return 'Tournament';
            if (obj.stages) return 'TournamentBracket';
            if (obj.isRegistered !== undefined) return 'TournamentRegistration';
            if (obj.withdrawable !== undefined) return 'Wallet';
            if (obj.bankName !== undefined && obj.accountNumber !== undefined && obj.recipientCode !== undefined) return 'Bank';
            if (obj.isLocal) return 'BankList';
            if (obj.banks !== undefined && Array.isArray(obj.banks)) return 'PaystackBankList';
            if (obj.accountName !== undefined && obj.accountNumber !== undefined && obj.bankId !== undefined) return 'AccountVerification';
            if (obj.url && obj.fileName && !obj.user) return 'UploadedFile';
            if (obj.files && Array.isArray(obj.files)) return 'UploadedFiles';

            console.error('[GraphQL Union Resolver] Failed to resolve type for keys:', Object.keys(obj));
            return null;
        }
    },
    Query: {
        ...userQueries,
        ...gameQueries,
        ...tournamentQueries,
        ...walletQueries,
    },
    Mutation: {
        ...userMutations,
        ...gameMutations,
        ...tournamentMutations,
        ...walletMutations,
        ...uploadMutations,
    }
}

export default resolvers;