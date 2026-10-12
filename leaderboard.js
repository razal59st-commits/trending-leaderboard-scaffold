
import Redis from "ioredis";
import "dotenv/config";

const redis = new Redis(process.env.REDIS_URL);

/**
 * Record one unit of engagement for a post.
 * Uses one atomic Redis command.
 *
 * @param {string} postId
 * @returns {Promise<string>}
 */
export async function upvote(postId) {
  return redis.zincrby("trending:posts", 1, postId);
}

/**
 * Fetch the top N posts with their metadata.
 *
 * @param {number} n
 * @returns {Promise<Array<{id: string, score: number, title?: string, author?: string}>>}
 */
export async function getTop(n) {
  // 1. Get the top N posts with their scores.
  const flat = await redis.zrevrange(
    "trending:posts",
    0,
    n - 1,
    "WITHSCORES"
  );

  const rows = [];
  const pipeline = redis.pipeline();

  // 2. Build post rows and queue metadata requests.
  for (let i = 0; i < flat.length; i += 2) {
    rows.push({
      id: flat[i],
      score: Number(flat[i + 1]),
    });

    pipeline.hgetall(`${flat[i]}:meta`);
  }

  // 3. Execute all metadata requests in one pipeline.
  const results = await pipeline.exec();

  // 4. Combine post information with metadata.
  return rows.map((row, k) => ({
    ...row,
    ...results[k][1],
  }));
}

export { redis };
