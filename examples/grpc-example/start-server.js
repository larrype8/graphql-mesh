const { Server, loadPackageDefinition, ServerCredentials } = require('@grpc/grpc-js');
const { load } = require('@grpc/proto-loader');
const { join } = require('path');

const seconds = new Date('2020-12-20').getTime();

const Genre = {
  UNSPECIFIED: 0,
  ACTION: 1,
  DRAMA: 2,
};

const Movies = [
  {
    cast: ['Tom Cruise', 'Simon Pegg', 'Jeremy Renner'],
    name: 'Mission: Impossible Rogue Nation',
    rating: 0.97,
    year: 2015n,
    time: {
      seconds,
    },
    genre: Genre.ACTION,
  },
  {
    cast: ['Tom Cruise', 'Simon Pegg', 'Henry Cavill'],
    name: 'Mission: Impossible - Fallout',
    rating: 0.93,
    year: 2018n,
    time: {
      seconds,
    },
    genre: Genre.ACTION,
  },
  {
    cast: ['Leonardo DiCaprio', 'Jonah Hill', 'Margot Robbie'],
    name: 'The Wolf of Wall Street',
    rating: 0.78,
    year: 2013n,
    time: {
      seconds,
    },
    genre: Genre.DRAMA,
  },
];

module.exports = function startServer(subscriptionInterval = 1000, debug = false) {
  return new Promise(async (resolve, reject) => {
    try {
      const logger = debug ? (...args) => console.log(...args) : () => {};
      const server = new Server();

      const packageDefinition = await load('./service.proto', {
        includeDirs: [join(__dirname, './proto')],
      });
      const grpcObject = loadPackageDefinition(packageDefinition);
      server.addService(grpcObject.Example.service, {
        getMovies(call, callback) {
          const result = Movies.filter(movie => {
            for (const [key, value] of Object.entries(call.request.movie)) {
              if (movie[key] === value) {
                return true;
              }
            }
          });
          const moviesResult = { result };
          logger('called with MetaData:', JSON.stringify(call.metadata.getMap()));
          callback(null, moviesResult);
        },
        async searchMoviesByCast(call) {
          logger('call started');
          logger('called with MetaData:', JSON.stringify(call.metadata.getMap()));
          const input = call.request;
          call.on('error', error => {
            console.error(error);
            call.end();
          });
          for (const movie of Movies) {
            await new Promise(resolve => setTimeout(resolve, subscriptionInterval));
            if (call.cancelled || call.destroyed) {
              logger('call ended');
              return;
            }
            if (movie.cast.includes(input.castName)) {
              logger('call received', movie);
              call.write(movie);
            }
          }
          call.end();
        },
      });
      server.bindAsync('0.0.0.0:50051', ServerCredentials.createInsecure(), (error, port) => {
        if (error) {
          reject(error);
        }
        server.start();

        logger('Server started, listening: 0.0.0.0:' + port);
        resolve(server);
      });
    } catch (e) {
      reject(e);
    }
  });
};
