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
            if (obj.email) {
                return 'User';
            }
            if (obj.currentTurn) {
                return 'LudoGameState';
            }
            if (obj.title) {
                return 'Tournament';
            }
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