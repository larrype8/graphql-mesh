import { printSchemaWithDirectives } from '@graphql-tools/utils';
import { fetch } from '@whatwg-node/fetch';
import getPort from 'get-port';
import { GraphQLSchema, parse, validate, execute } from 'graphql';
import { loadGraphQLSchemaFromOpenAPI } from '../src/loadGraphQLSchemaFromOpenAPI.js';

import { startServer, stopServer } from './nested_objects_server.js';

describe('OpanAPI: nested objects', () => {
  /**
   * Set up the schema first and run example API server
   */
  let createdSchema: GraphQLSchema;
  let port: number;
  beforeAll(async () => {
    port = await getPort();
    // Update PORT for this test case:
    createdSchema = await loadGraphQLSchemaFromOpenAPI('example_api', {
      fetch,
      endpoint: `http://localhost:{context.port}`,
      source: './fixtures/nested_object.json',
      cwd: __dirname,
      queryStringOptions: {
        allowDots: true,
      },
    });
    await startServer(port);
  });

  /**
   * Shut down API server
   */
  afterAll(() => stopServer());

  it('should generate the schema correctly', () => {
    expect(printSchemaWithDirectives(createdSchema)).toMatchSnapshot();
  });

  it('Get response', async () => {
    const query = /* GraphQL */ `
      {
        searchCollection(
          collectionName: "CHECKOUT_SUPER_PRODUCT"
          searchParameters: { q: "water", query_by: "name" }
        ) {
          ... on SearchResult {
            hits {
              document
            }
          }
        }
      }
    `;

    const ast = parse(query);
    const errors = validate(createdSchema, ast);
    expect(errors).toEqual([]);

    const result = await execute({
      schema: createdSchema,
      document: parse(query),
      contextValue: {
        port,
      },
    });

    expect(result).toEqual({
      data: {
        searchCollection: {
          hits: [
            {
              document: 'Something goes here',
            },
          ],
        },
      },
    });
  });
});
