import PrefixTransform from '../src/index.js';
import { printSchema, GraphQLSchema, GraphQLObjectType, execute, parse } from 'graphql';
import InMemoryLRUCache from '@graphql-mesh/cache-localforage';
import { MeshPubSub } from '@graphql-mesh/types';
import { DefaultLogger, PubSub } from '@graphql-mesh/utils';
import { wrapSchema } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';

describe('wrapPrefix', () => {
  let schema: GraphQLSchema;
  let cache: InMemoryLRUCache;
  let pubsub: MeshPubSub;
  const baseDir: string = undefined;

  beforeEach(() => {
    schema = makeExecutableSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          user: User!
          posts: [Post!]!
          node(id: ID!): Node
        }

        union Node = User | Post

        type User {
          id: ID!
        }

        type Post {
          id: ID!
          title: String!
        }
      `,
      resolvers: {
        Query: {
          node(_, { id }) {
            return {
              id,
            };
          },
        },
        Node: {
          __resolveType(obj: any) {
            if (obj.title) {
              return 'Post';
            }
            return 'User';
          },
        },
      },
    });
    cache = new InMemoryLRUCache();
    pubsub = new PubSub();
  });

  it('should prefix all schema types when prefix is specified explicitly', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            value: 'T_',
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    expect(newSchema.getType('User')).toBeUndefined();
    expect(newSchema.getType('T_User')).toBeDefined();
    expect((newSchema.getType('Query') as GraphQLObjectType).getFields()).not.toHaveProperty(
      'T_user',
    );
    expect(printSchema(newSchema)).toMatchSnapshot();
  });

  it('should not modify root types', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            value: 'T_',
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    expect(newSchema.getType('Query')).toBeDefined();
    expect(newSchema.getType('T_Query')).toBeUndefined();
  });

  it('should not modify default scalar types', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            value: 'T_',
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    const postFields = (newSchema.getType('T_Post') as GraphQLObjectType).getFields();
    expect(postFields.id.type.toString()).toBe('ID!');
    expect(postFields.title.type.toString()).toBe('String!');
  });

  it('should use apiName when its available', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {},
          apiName: 'MyApi',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    expect(newSchema.getType('Query')).toBeDefined();
    expect(newSchema.getType('User')).toBeUndefined();
    expect(newSchema.getType('MyApi_User')).toBeDefined();
  });

  it('should allow to ignore types', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            value: 'T_',
            ignore: ['User'],
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    expect(newSchema.getType('Query')).toBeDefined();
    expect(newSchema.getType('User')).toBeDefined();
  });

  it('should modify fields', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            value: 'T_',
            includeRootOperations: true,
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    expect(newSchema.getType('Query')).toBeDefined();
    expect(newSchema.getType('T_User')).toBeDefined();
    expect((newSchema.getType('Query') as GraphQLObjectType).getFields()).toHaveProperty('T_user');
  });

  it('should allow to ignore all fields in Type', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            value: 'T_',
            includeRootOperations: true,
            ignore: ['Query'],
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    const queryFields = (newSchema.getType('Query') as GraphQLObjectType).getFields();
    expect(newSchema.getType('Query')).toBeDefined();
    expect(newSchema.getType('T_User')).toBeDefined();
    expect(newSchema.getType('User')).toBeUndefined();
    expect(queryFields).not.toHaveProperty('T_user');
    expect(queryFields).toHaveProperty('user');
    expect(queryFields).not.toHaveProperty('T_posts');
    expect(queryFields).toHaveProperty('posts');
  });

  it('should allow to ignore specific fields', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            value: 'T_',
            includeRootOperations: true,
            ignore: ['Query.user'],
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    const queryFields = (newSchema.getType('Query') as GraphQLObjectType).getFields();
    expect(newSchema.getType('Query')).toBeDefined();
    expect(newSchema.getType('T_User')).toBeDefined();
    expect(newSchema.getType('User')).toBeUndefined();
    expect(queryFields).not.toHaveProperty('T_user');
    expect(queryFields).toHaveProperty('user');
    expect(queryFields).toHaveProperty('T_posts');
    expect(queryFields).not.toHaveProperty('posts');
  });

  it('should allow to ignore types', () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            value: 'T_',
            includeRootOperations: true,
            includeTypes: false,
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });
    expect(newSchema.getType('Query')).toBeDefined();
    expect(newSchema.getType('T_User')).toBeUndefined();
    expect(newSchema.getType('User')).toBeDefined();
  });
  it('should handle union type resolution', async () => {
    const newSchema = wrapSchema({
      schema,
      transforms: [
        new PrefixTransform({
          config: {
            mode: 'wrap',
            value: 'T_',
            includeRootOperations: true,
          },
          apiName: '',
          baseDir,
          cache,
          pubsub,
          importFn: m => import(m),
          logger: new DefaultLogger(),
        }),
      ],
    });

    const result = await execute({
      schema: newSchema,
      document: parse(/* GraphQL */ `
        query {
          T_node(id: "1") {
            __typename
          }
        }
      `),
    });
    expect(result).toEqual({
      data: {
        T_node: {
          __typename: 'T_User',
        },
      },
    });
  });
});
