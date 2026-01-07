import GraphQLJSON from "graphql-type-json";
import { GraphQLUpload } from "graphql-upload";

import { userQueries, userMutations } from './user';
import { gameQueries, gameMutations } from './game';


const resolvers = {
    JSON: GraphQLJSON,
    Upload: GraphQLUpload,
    ResponseData: {
        __resolveType(obj: any, _: any, __: any) {
            if (obj.email) {
                return 'User';
            }
            if (obj.currentTurn) {
                return 'Game';
            }
            return null;
        }
    },
    Query: {
        ...userQueries,
        ...gameQueries,
    },
    Mutation: {
        ...userMutations,
        ...gameMutations,
    }
}

export default resolvers;