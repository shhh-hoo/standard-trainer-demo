import { createServer } from "node:http";
import {
  LocalDemoRegistryProvider,
  StaticBundledRegistryProvider,
  createDiagnosisApiHandler,
  loadMergedRegistry,
} from "../src/foundry-runtime/index.ts";

const port = Number(process.env.TRAINER_DIAGNOSIS_PORT ?? 4177);
const providers = [
  new StaticBundledRegistryProvider(),
  ...(process.env.COMPONENT_REGISTRY_URL ? [new LocalDemoRegistryProvider(process.env.COMPONENT_REGISTRY_URL)] : []),
];
const registry = await loadMergedRegistry(providers);
const handle = createDiagnosisApiHandler({ registry });

const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const url = `http://127.0.0.1:${port}${request.url ?? "/"}`;
  const webRequest = new Request(url, {
    method: request.method,
    headers: Object.fromEntries(Object.entries(request.headers).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value.join(", ") : value]])),
    ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
  });
  const result = await handle(webRequest);
  response.writeHead(result.status, Object.fromEntries(result.headers.entries()));
  response.end(Buffer.from(await result.arrayBuffer()));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Trainer Diagnosis API listening on http://127.0.0.1:${port}`);
});
