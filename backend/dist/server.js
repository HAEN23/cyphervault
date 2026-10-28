import "dotenv/config";
import { createServer } from "node:http";
const port = Number(process.env.PORT ?? 3001);
const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("CipherVault API\n");
});
server.listen(port, () => {
    console.log(`CipherVault backend listening on port ${port}`);
});
