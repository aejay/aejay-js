import * as aws from "@cdktf/provider-aws";
import * as random from "@cdktf/provider-random";
import { Construct } from "constructs";
import BucketDistribution from "./BucketDistribution";
import DirectoryBucket from "./DirectoryBucket";

/**
 * Options for configuring an instance of {@link SinglePageApp}.
 */
export interface SinglePageAppOptions {
  /** The path to the local build directory for the SPA, which should be uploaded to S3. */
  localPath: string;

  /** The ARN of the ACM certificate the site should use for TLS. */
  certificateArn: string;
  /** A list of domains that the SPA will be served from.  */
  domainAliases: string[];
  /** The ID of the Route53 hosted zone to create DNS records in for each domain. */
  r53zoneId: string;
}

/**
 * A resource that stands up the resources needed to host a SPA served up
 * as static resources.
 */
export default class SinglePageApp extends Construct {
  bucket: DirectoryBucket;
  distribution: BucketDistribution;

  /**
   *
   * @param scope The construct (resource or app) that contains this instance.
   * @param id The ID of this instance, which should be unique to the scope.
   * @param options The options for configuring this instance.
   */
  constructor(scope: Construct, id: string, options: SinglePageAppOptions) {
    super(scope, id);

    const { localPath, certificateArn, domainAliases, r53zoneId } = options;

    // Generate a unique ID so we don't trip over ourselves with multiple
    // SPAs in one AWS account.
    const functionId = new random.id.Id(this, `rewrite-function-id`, {
      byteLength: 6,
      prefix: "rewrite-function-",
    });

    const rewriteFunction = new aws.cloudfrontFunction.CloudfrontFunction(
      this,
      `rewrite-function`,
      {
        name: functionId.b64Url,
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
