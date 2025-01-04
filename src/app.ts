import express from "express"
import httpServer from "http"
import { graphqlUploadExpress } from "graphql-upload";

import graphqlServer from './graphql';
import { expressPlayground } from "graphql-playground-middleware";
import loadAppEnvs, { env, port } from "./config/environment";


const App = async () => {
    let appEnv = { port, env };
    if (!env.development) {
        appEnv = loadAppEnvs();
    }
    const app = express();
    const graphqlHttpServer = httpServer.createServer(app);

    app.use(
        express.urlencoded({
            limit: '50mb',
            parameterLimit: 100000,
            extended: true,
        })
    );

    app.use(
        '/graphql',
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 })
    );

    await graphqlServer.start();

    graphqlServer.applyMiddleware({ app, path: '/graphql', cors: false });

    app.use(
        '/graphql',
        expressPlayground({
            endpoint: '/graphql',
        })
    );

    graphqlHttpServer.listen(appEnv.port, async () => {
        console.log(
            `Server started on http://localhost:${appEnv.port}${graphqlServer.graphqlPath}`
        );
    });
}

App();