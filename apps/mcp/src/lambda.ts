import awsLambdaFastify from "@fastify/aws-lambda";
import { buildServer } from "./server";
import { loadLibraryResilient } from "./library";
import { DynamoProgressStore } from "./progress";

/**
 * AWS Lambda entry point for the EveryWord MCP server.
 *
 * The same Fastify app that runs locally, wrapped for Lambda. The only
 * difference is where the library comes from: locally it is read from the
 * content directory on disk, and here it is fetched from the deployed
 * content directory on CloudFront. Both are the same files, which is the
 * property worth keeping: the agent's catalogue and the reader's catalogue
 * cannot drift apart because there is only one of them.
 *
 * Reading progress is persisted in DynamoDB. That is not incidental:
 * reading practice measured in RAM is not measured at all, because a parent
 * asking on Sunday about a week of reading would get back whatever happened
 * to survive the last cold start. Sessions are an append-only log and every
 * number reported is derived from it, so a summary can never drift from the
 * sessions that produced it.
 */

const contentUrl = process.env.CONTENT_URL;
if (!contentUrl) {
  throw new Error("CONTENT_URL must be set in the Lambda environment");
}

const tableName = process.env.PROGRESS_TABLE;
if (!tableName) {
  throw new Error("PROGRESS_TABLE must be set in the Lambda environment");
}

const loaded = await loadLibraryResilient({ url: contentUrl });
if (loaded.note) console.warn(loaded.note);
export const librarySource = loaded.source;

const { app } = buildServer({
  library: loaded.library,
  progress: new DynamoProgressStore(tableName),
  librarySource: loaded.source,
});

export const handler = awsLambdaFastify(app);
