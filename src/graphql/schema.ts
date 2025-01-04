import { join } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { makeExecutableSchema } from '@graphql-tools/schema';

import resolvers from './resolvers';
// import { authDirectiveTypeDefs, authDirectiveTransformer } from './directives';

const typeDefsPath = join(__dirname, './typedefs');
//const typeDefsPath = 'src/graphql/typedefs';
const gqlFiles = readdirSync(typeDefsPath);

let typeDefs = ``;

// typeDefs += authDirectiveTypeDefs;

gqlFiles.forEach(file => {
  typeDefs += readFileSync(join(typeDefsPath, file), {
    encoding: 'utf8',
  });
});

let schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// schema = authDirectiveTransformer(schema);

export default schema;