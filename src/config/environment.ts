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

    return { port, env };
};

const { port, env } = loadAppEnvs();

export { port, env };

export default loadAppEnvs;