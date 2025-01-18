import mongoose from 'mongoose';
import { db } from '../config/environment';

export default async function startDB(cstring: string | undefined = db.uri) {
    try {
        await mongoose.connect(cstring || '');
        // todo workaround for HMR. It remove old model before added new ones
        // Object.keys(mongoose.connection.models).forEach(key => {
        //   delete mongoose.connection.models[key];
        // });
        const connection = mongoose.connection as any
        const connections = connection?.base?.connections;
        console.log(`Connected to MongoDb. Current connection pool size: ${connections?.length}`);
    } catch (error) {
        console.error(error);
    }
}
