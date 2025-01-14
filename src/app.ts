import express from "express"
import httpServer from "http"
import { graphqlUploadExpress } from "graphql-upload";

import graphqlServer from './graphql';
import { expressPlayground } from "graphql-playground-middleware";
import loadAppEnvs, { env, port, db } from "./config/environment";
import startDB from "./startup/db";


const App = async () => {
    let appEnv = { port, env, db };
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

    app.use('*', (req, res) => {
        res.send(`route not found for ${req.originalUrl}`)
    });

    graphqlHttpServer.listen(appEnv.port, async () => {
        startDB(appEnv.db.uri);
        console.log(
            `Server started on http://localhost:${appEnv.port}${graphqlServer.graphqlPath}`
        );
    });
}

App();