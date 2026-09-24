import {makeServer} from "./server";

const start = async () => {
  const server = await makeServer();

  server.listen(3020, () => {
    console.log('Server running at http://localhost:3020/graphql');
  });
};

start();
