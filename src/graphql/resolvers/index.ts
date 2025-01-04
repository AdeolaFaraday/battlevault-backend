import GraphQLJSON from "graphql-type-json";
import { GraphQLUpload } from "graphql-upload";

import { userQueries, userMutations } from './user';


const resolvers = {
    JSON: GraphQLJSON,
    Upload: GraphQLUpload,
    ResponseData: {
        __resolveType(obj: any, _: any, __: any) {
            if (obj.email) {
                return 'User';
            }
            return null;
        }
    },
    Query: {
        ...userQueries,
    },
    Mutation: {
        ...userMutations,
    }
}

export default resolvers;