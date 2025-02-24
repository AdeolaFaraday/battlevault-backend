import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";

import schema from "./schema"
import { env } from "../config/environment";
import { buildContext } from "./services/auth/buildContext";


const apolloServer: any = new ApolloServer({
    schema,
    context: ({ req, res }) => buildContext({ req, res }),
    plugins: env.development
        ? [ApolloServerPluginLandingPageGraphQLPlayground]
        : [],
});

export default apolloServer;