import api from '@/lib/axios';

const REQUEST_TIMEOUT_MS = 30000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The server can be asleep for a moment on a free plan: if it did not answer at all, try once more
async function withRetry(call) {
  try {
    return await call();
  } catch (err) {
    if (err?.response) throw err; // the server answered with an error: retrying will not help
    await wait(1500);
    return call();
  }
}

export const musicApi = {
  search: async (q) => {
    const { data } = await withRetry(() =>
      api.get('/music/search', { params: { q }, timeout: REQUEST_TIMEOUT_MS })
    );
    return data.data.tracks;
  },

  resolve: async (url) => {
    const { data } = await withRetry(() =>
      api.get('/music/resolve', { params: { url }, timeout: REQUEST_TIMEOUT_MS })
    );
    return data.data.track;
  },
};