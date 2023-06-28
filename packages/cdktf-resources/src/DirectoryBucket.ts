import * as aws from "@cdktf/provider-aws";
import { Construct } from "constructs";
import {
  AssetType,
  Fn,
  TerraformAsset,
  TerraformIterator,
  TerraformLocal,
} from "cdktf";

interface DirectoryBucketOptions {
  localPath: string;
}

/**
 * A resource that stands up an S3 bucket and populates it with the given folder's
 * contents, using a map of common mime types to assign to files (based on their
 * file extension).
 */
export default class DirectoryBucket extends Construct {
  bucket: aws.s3Bucket.S3Bucket;

  constructor(scope: Construct, id: string, options: DirectoryBucketOptions) {
    super(scope, id);

    const { localPath } = options;

    const { path } = new TerraformAsset(this, "app-assets", {
      type: AssetType.DIRECTORY,
      path: localPath,
    });

    const mimeTypes = new TerraformLocal(this, "mime_types", {
      ".bmp": "image/bmp",
      ".css": "text/css",
      ".csv": "text/csv",
      ".gif": "image/gif",
      ".htm": "text/html",
      ".html": "text/html",
      ".ico": "image/vnd.microsoft.icon",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".js": "text/javascript",
      ".json": "application/json",
      ".otf": "font/otf",
      ".pdf": "application/pdf",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
      ".txt": "text/plain",
      ".weba": "audio/webm",
      ".webm": "video/webm",
      ".webp": "image/webp",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".xml": "application/xml",
    });

    this.bucket = new aws.s3Bucket.S3Bucket(this, `bucket`, {});

    const fileset = Fn.fileset(path, "**");

    const fileIterator = TerraformIterator.fromList(fileset);

    new aws.s3Object.S3Object(this, "file", {
      forEach: fileIterator,
      bucket: this.bucket.bucket,
      key: fileIterator.value,
      source: `${path}/${fileIterator.value}`,
      contentType: Fn.lookup(
        mimeTypes.expression,
        Fn.regex("\\\\.[^.]+$", fileIterator.value),
        null,
      ),
      cacheControl: "public, max-age 86400, s-maxage 300",
    });
  }
}
