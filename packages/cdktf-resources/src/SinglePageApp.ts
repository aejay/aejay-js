import * as aws from "@cdktf/provider-aws";
import { Construct } from "constructs";
import BucketDistribution from "./BucketDistribution";
import DirectoryBucket from "./DirectoryBucket";

interface SinglePageAppOptions {
  localPath: string;

  certificateArn?: string;
  domainAliases?: string[];
  r53zoneId?: string;
}

/**
 * A resource that stands up the resources needed to host a SPA served up
 * as static resources.
 */
export default class SinglePageApp extends Construct {
  bucket: DirectoryBucket;
  distribution: BucketDistribution;

  constructor(scope: Construct, id: string, options: SinglePageAppOptions) {
    super(scope, id);

    const { localPath, certificateArn, domainAliases, r53zoneId } = options;

    const rewriteFunction = new aws.cloudfrontFunction.CloudfrontFunction(
      this,
      `rewrite-function`,
      {
        name: `rewrite-function`,
        runtime: "cloudfront-js-1.0",
        // TODO: Figure out a better way to build/supply the code for this
        // function so it's not defined inline. A hurdle with this is that
        // AWS decided to make their own JS engine for this. Neat.

        // This function looks at the path for incoming requests and decides
        // whether to rewrite the URL to direct the request to the index.html
        // of the SPA, or whether to pass the request through (like when making
        // requests for images/js/css/etc).
        code: `
          function handler(event) {
            var passthroughPrefixes = [
              "/assets/",
              "/robots.txt",
              "/favicon",
              "/humans.txt",
              "/manifest.json",
            ];
            var request = event.request;
            
            if (passthroughPrefixes.some((prefix) => request.uri.startsWith(prefix))) {
              return request;
            }
            request.uri = "/index.html";
            return request;
          }
        `,
      },
    );

    this.bucket = new DirectoryBucket(this, "bucket", {
      localPath,
    });

    this.distribution = new BucketDistribution(this, "distribution", {
      bucketId: this.bucket.bucket.id,
      bucketDomain: this.bucket.bucket.bucketRegionalDomainName,
      viewerRequestFunctionArn: rewriteFunction.arn,
      certificateArn,
      domainAliases,
      r53zoneId,
    });
  }
}
