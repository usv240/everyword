import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { App, CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import {
  Distribution,
  Function as CfFunction,
  FunctionCode,
  FunctionEventType,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Duration } from "aws-cdk-lib";
import { FunctionUrlAuthType, HttpMethod, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

/**
 * EveryWord stack: the statically exported reader (with its bundled
 * public-domain content and generated captions) on S3 behind CloudFront,
 * plus the MCP server on Lambda behind a function URL.
 *
 * The MCP server loads its library from the deployed content directory over
 * CloudFront rather than from a bundled copy, so the agent's catalogue and
 * the reader's catalogue are the same files by construction. The caption
 * pipeline's S3 bucket and Amazon Transcribe usage are documented in
 * docs/AWS.md.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

class EveryWordStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const siteBucket = new Bucket(this, "Site", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const indexRewrite = new CfFunction(this, "IndexRewrite", {
      code: FunctionCode.fromInline(
        "function handler(event) { var req = event.request; var uri = req.uri; if (uri.endsWith('/')) { req.uri = uri + 'index.html'; } else if (!uri.includes('.')) { req.uri = uri + '/index.html'; } return req; }",
      ),
    });

    const distribution = new Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          { function: indexRewrite, eventType: FunctionEventType.VIEWER_REQUEST },
        ],
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 404, responsePagePath: "/404.html" },
      ],
    });

    new BucketDeployment(this, "SiteDeployment", {
      sources: [Source.asset(path.join(here, "../../apps/web/out"))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    const siteUrl = `https://${distribution.distributionDomainName}`;

    // Reading progress: an append-only session log. Partition key
    // READER#{id}, sort key SESSION#{iso}#{slug}. Every number a parent is
    // told is derived from this log, never stored pre-aggregated.
    const progressTable = new Table(this, "ReadingProgress", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // The MCP server: the Alexa+ surface. Model Context Protocol 2025-11-25
    // over Streamable HTTP, the same Fastify app that runs locally.
    const mcp = new NodejsFunction(this, "McpServer", {
      entry: path.join(here, "../../apps/mcp/src/lambda.ts"),
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      environment: {
        CONTENT_URL: `${siteUrl}/content`,
        PROGRESS_TABLE: progressTable.tableName,
      },
      bundling: {
        format: OutputFormat.ESM,
        target: "node20",
        externalModules: ["@aws-sdk/*"],
        // Some transitive dependencies still use require() inside ESM output.
        banner:
          "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
    });

    progressTable.grantReadWriteData(mcp);

    const mcpUrl = mcp.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [HttpMethod.ALL],
        allowedHeaders: ["*"],
        // MCP clients must be able to read the session id off the response.
        exposedHeaders: ["MCP-Session-Id"],
      },
    });

    new CfnOutput(this, "SiteUrl", { value: siteUrl });
    new CfnOutput(this, "McpUrl", { value: `${mcpUrl.url}mcp` });
  }
}

const app = new App();
new EveryWordStack(app, "EveryWord", {
  env: { region: process.env.CDK_DEFAULT_REGION ?? "us-east-1" },
  description:
    "EveryWord: karaoke captions reader on S3 and CloudFront, plus the MCP server on Lambda.",
});
