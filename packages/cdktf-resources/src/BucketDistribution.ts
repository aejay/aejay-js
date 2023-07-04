import * as aws from "@cdktf/provider-aws";
import * as random from "@cdktf/provider-random";
import { Fn, TerraformIterator } from "cdktf";
import { Construct } from "constructs";

/**
 * Options for configuring an instance of {@link BucketDistribution}.
 */
export interface BucketDistributionOptions {
  /** The ID of the S3 bucket you want served by CloudFront. */
  bucketId: string;
  /** The regional domain of the S3 bucket you want served by CloudFront. */
  bucketDomain: string;

  /** The ARN of the ACM certificate the distribution should use for TLS. */
  certificateArn: string;
  /** A list of domains that the distribution will be served from.  */
  domainAliases: string[];
  /** The ID of the Route53 hosted zone to create DNS records in for each domain. */
  r53zoneId: string;
  /** The ARN of a function for processing incoming viewer requests, if any. */
  viewerRequestFunctionArn?: string;
}

/**
 * A resource that stands up a cloudfront distribution for an S3 bucket,
 * optionally with Route53 routes pointing domain(s) to it.
 */
export default class BucketDistribution extends Construct {
  distribution: aws.cloudfrontDistribution.CloudfrontDistribution;

  /**
   *
   * @param scope The construct (resource or app) that contains this instance.
   * @param id The ID of this instance, which should be unique to the scope.
   * @param options The options for configuring this instance.
   */
  constructor(
    scope: Construct,
    id: string,
    options: BucketDistributionOptions,
  ) {
    super(scope, id);

    const {
      bucketId,
      bucketDomain,
      certificateArn,
      domainAliases,
      r53zoneId,
      viewerRequestFunctionArn,
    } = options;

    const originId = "s3Origin";

    const controlId = new random.id.Id(this, `access-control-id`, {
      byteLength: 6,
      prefix: "access-control-",
    });

    const accessControl =
      new aws.cloudfrontOriginAccessControl.CloudfrontOriginAccessControl(
        this,
        "access-control",
        {
          name: controlId.b64Url,
          originAccessControlOriginType: "s3",
          signingBehavior: "always",
          signingProtocol: "sigv4",
        },
      );

    // TODO: is there a fancy way I can get the terraform deploy to cause an
    // invalidation of the distribution, to clear out the existing cache?
    this.distribution = new aws.cloudfrontDistribution.CloudfrontDistribution(
      this,
      `distribution`,
      {
        enabled: true,
        isIpv6Enabled: true,
        comment: `Distribution for the ${bucketId} bucket`,
        aliases: domainAliases,
        origin: [
          {
            originId,
            domainName: bucketDomain,
            originAccessControlId: accessControl.id,
          },
        ],
        defaultRootObject: "index.html",
        defaultCacheBehavior: {
          allowedMethods: ["GET", "HEAD", "OPTIONS"],
          cachedMethods: ["GET", "HEAD"],
          forwardedValues: {
            queryString: false,
            cookies: {
              forward: "none",
            },
          },
          compress: true,
          functionAssociation: viewerRequestFunctionArn
            ? [
                {
                  eventType: "viewer-request",
                  functionArn: viewerRequestFunctionArn,
                },
              ]
            : undefined,
          targetOriginId: originId,
          defaultTtl: 300,
          maxTtl: 86400,
          viewerProtocolPolicy: "redirect-to-https",
        },
        restrictions: {
          geoRestriction: {
            restrictionType: "whitelist",
            locations: ["US"],
          },
        },
        viewerCertificate: certificateArn
          ? {
              acmCertificateArn: certificateArn,
              sslSupportMethod: "sni-only",
            }
          : {
              cloudfrontDefaultCertificate: true,
            },
      },
    );

    const document = new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
      this,
      "policy-document",
      {
        statement: [
          {
            effect: "Allow",
            principals: [
              { type: "Service", identifiers: ["cloudfront.amazonaws.com"] },
            ],
            actions: ["s3:GetObject"],
            resources: [
              `arn:aws:s3:::${bucketId}`,
              `arn:aws:s3:::${bucketId}/*`,
            ],
            condition: [
              {
                test: "StringEquals",
                variable: "AWS:SourceArn",
                values: [this.distribution.arn],
              },
            ],
          },
        ],
      },
    );

    new aws.s3BucketPolicy.S3BucketPolicy(this, `bucket-policy`, {
      bucket: bucketId,
      policy: document.json,
    });

    const domainIterator = TerraformIterator.fromList(Fn.toset(domainAliases));

    new aws.route53Record.Route53Record(this, `route`, {
      forEach: domainIterator,

      zoneId: r53zoneId,
      name: domainIterator.value,
      type: "A",

      alias: {
        name: this.distribution.domainName,
        zoneId: this.distribution.hostedZoneId,
        evaluateTargetHealth: false,
      },
    });
  }
}
