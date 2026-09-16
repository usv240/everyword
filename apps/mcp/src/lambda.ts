import awsLambdaFastify from "@fastify/aws-lambda";
import { buildServer } from "./server";
import { loadLibraryFromUrl } from "./library";

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
 * Reading progress is in-process for this build, so it resets when Lambda
 * recycles the container. That is the honest scope of a demo; the
 * ProgressStore interface is deliberately narrow so a DynamoDB
 * implementation drops in without touching the MCP layer.
 */

const contentUrl = process.env.CONTENT_URL;
if (!contentUrl) {
  throw new Error("CONTENT_URL must be set in the Lambda environment");
}

const library = await loadLibraryFromUrl(contentUrl);
const { app } = buildServer({ library });

export const handler = awsLambdaFastify(app);
