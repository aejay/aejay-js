# @aejay/cdktf-resources

A set of [Terraform CDK](https://developer.hashicorp.com/terraform/cdktf)
resources that Aejay uses for his portfolio projects to keep from having to
repeat himself too frequently.

## Using these resources

These resources require installing this package (`@aejay/cdktf-resources`) as a
dependency, and setting up the proper provider(s), which are documented by
resource (along with their usage snippet) in the sections below.

### `DirectoryBucket`

Requires:

- A path to where the assets are stored locally.
- A configured
  [local provider](https://www.npmjs.com/package/@cdktf/provider-local) for
  reading the local files to upload them.
- A configured [AWS provider](https://www.npmjs.com/package/@cdktf/provider-aws)
  for creating the S3 bucket and its uploaded objects.

This resource creates an S3 bucket and populates it using the contents of a
folder that is local to the executer of the terraform. If files are added,
removed, or changed (according to the hashing function) on subsequent runs, this
should update the files in S3 accordingly.

This resource also maintains a map of filetypes common to the web based on file
extensions, to try to configure their mimetype to serve up correctly, falling
back to the AWS default if the extension is unknown.

#### Usage

```ts
class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new local.provider.LocalProvider(this, "local", {});

    new aws.provider.AwsProvider(this, "aws", {
      // provider config here, like region
    });

    const localPath = resolve(__dirname, "./some-local-path/");

    new DirectoryBucket(this, "bucket", {
      localPath,
    });
  }
}
```

### `BucketDistribution`

Requires:

- The ID and regional domain name of an S3 bucket (perhaps one created with the
  [DirectoryBucket](#directorybucket) resource)
- A list of domains the distribution should be served from
- The ID of a Route53 zone to create DNS records, one for each of those domains
- The ARN of an ACM certificate to act as the TLS cert via SNI
- A configured [AWS provider](https://www.npmjs.com/package/@cdktf/provider-aws)
  for creating the distribution and its associated Route53 rule(s)

This resource creates a CloudFront distribution that uses the specified S3
bucket as the origin, and assigns a Route53 record to direct traffic to that
distribution.

The `viewerRequestFunctionArn` option for this resource allows you to define a
Lambda function to transform requests into the distribution prior to passing
them along to the origin S3 bucket. This is leveraged by the
[SinglePageApp](#singlepageapp) resource to define the SPA behaviors.

#### Usage

```ts
class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new aws.provider.AwsProvider(this, "aws", {
      // provider config here, like region
    });

    new BucketDistribution(this, "distribution", {
      // Excluded for brevity, but some or all of these values would be pulled from TerraformVariable instances:
      bucketId: "",
      bucketDomain: "",

      certificateArn: "",
      domainAliases: ["", ""],
      r53zoneId: "",
    });
  }
}
```

### `SinglePageApp`

Requires:

- A path to where the SPA build assets are stored locally
- A list of domains the SPA should be served from
- The ID of a Route53 zone to create DNS records in for each of those domains
- The ARN of an ACM certificate to act as the TLS cert via SNI
- Due to using the two resources above, you'll also need:
  - A configured
    [local provider](https://www.npmjs.com/package/@cdktf/provider-local) for
    reading the SPA files to upload them.
  - A configured
    [AWS provider](https://www.npmjs.com/package/@cdktf/provider-aws) for
    creating the resources above as well as the request rewrite function

This resource leverages both of the resources above to create an S3 bucket that
is exposed via CloudFront to one or more configured domains through Route53. It
also creates a CloudFront Function for rewriting incoming requests to map
non-static-asset requests to request the `index.html` file from the S3 origin,
to have it behave as an SPA.

#### Usage

```ts
class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new local.provider.LocalProvider(this, "local", {});

    new aws.provider.AwsProvider(this, "aws", {
      // provider config here, like region
    });

    const localPath = resolve(__dirname, "./some-built-spa-path/");

    new SinglePageApp(this, "distribution", {
      localPath,

      // Excluded for brevity, but some or all of these values would be pulled from TerraformVariable instances:
      certificateArn: "",
      domainAliases: ["", ""],
      r53zoneId: "",
    });
  }
}
```
