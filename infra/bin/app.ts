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
import type { Construct } from "constructs";

/**
 * EveryWord web stack: the statically exported reader (with its bundled
 * public-domain content and generated captions) on S3 behind CloudFront.
 * The caption pipeline's S3 bucket and Amazon Transcribe usage are
 * documented in docs/AWS.md; this stack is only the public site.
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

    new CfnOutput(this, "SiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}

const app = new App();
new EveryWordStack(app, "EveryWord", {
  env: { region: process.env.CDK_DEFAULT_REGION ?? "us-east-1" },
  description:
    "EveryWord: karaoke captions reader. S3 and CloudFront static site.",
});
