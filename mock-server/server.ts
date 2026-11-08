import { createApp } from './app';
import { mockConfig } from './config';

createApp({ apiToken: mockConfig.API_TOKEN }).listen(mockConfig.MOCK_SERVER_PORT, () => {
  console.log(`[mock-server] Vehicle Ordering API listening on :${mockConfig.MOCK_SERVER_PORT}`);
});
