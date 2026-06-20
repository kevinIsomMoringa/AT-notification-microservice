import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`🚀 Notification microservice listening on port ${env.PORT}`);
  console.log(`   Health check: http://localhost:${env.PORT}/health`);
  console.log(`   Send endpoint: POST http://localhost:${env.PORT}/api/v1/notifications`);
});
