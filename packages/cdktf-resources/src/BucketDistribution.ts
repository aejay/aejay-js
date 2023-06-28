import * as aws from "@cdktf/provider-aws";
import { Construct } from "constructs";

interface BucketDistributionOptions {
  bucketId: string;
  bucketDomain: string;

  certificateArn?: string;
  domainAliases?: string[];
  r53zoneId?: string;
  viewerRequestFunctionArn?: string;
}

/**
 * A resource that stands up a cloudfront distribution for an S3 bucket,
 * optionally with Route53 routes pointing domain(s) to it.
 */
export default class BucketDistribution extends Construct {
  distribution: aws.cloudfrontDistribution.CloudfrontDistribution;

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

    const accessControl =
      new aws.cloudfrontOriginAccessControl.CloudfrontOriginAccessControl(
        this,
        "access-control",
        {
          name: `${this.node.id}-access-control`,
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
        comment: "Distribution for the aejay.com portfolio site",
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

    if (r53zoneId && domainAliases) {
      domainAliases.map(
        (alias) =>
          new aws.route53Record.Route53Record(this, `route-${alias}`, {
            zoneId: r53zoneId,
            name: alias,
            type: "A",

            alias: {
              name: this.distribution.domainName,
              zoneId: this.distribution.hostedZoneId,
              evaluateTargetHealth: false,
            },
          }),
      );
    }
  }
}
