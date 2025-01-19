import dotenv from 'dotenv';

dotenv.config();

const loadAppEnvs = () => {
    const port = process.env.PORT;

    // We may use this as a boolean value for different situations
    const env = {
        development: process.env.NODE_ENV === 'development',
        test: process.env.NODE_ENV === 'test',
        staging: process.env.NODE_ENV === 'staging',
        production: process.env.NODE_ENV === 'production',
    };

    const db = {
        uri: process.env.DB_CLOUD_CONNECTION,
        sessionSecret: process.env.DB_MONGO_SESSION_SECRET
    };

    const jwt = {
        jwtSecret: process.env.JWT_SECRET,
        jwtExp: process.env.JWT_EXP,
    };

    return { port, env, db, jwt };
};

const { port, env, db, jwt } = loadAppEnvs();

export { port, env, db, jwt };

export default loadAppEnvs;