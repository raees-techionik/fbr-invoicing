import "dotenv/config";
import { app } from "./app.js";
import { startAutomaticOfflineQueueProcessor } from "./services/fbr-offline-queue.service.js";

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
  startAutomaticOfflineQueueProcessor();
});
