#!/bin/bash


# upload to cloudfront
if [[ $1 == "prod" ]]; then

  echo "** Uploaded to prod s3 bucket **"
  aws s3 cp ./  s3://static.iobio.io/prod/vcf.iobio.io/ --recursive
  echo "** Renew cloudfrount cache **"
  aws cloudfront create-invalidation --distribution-id E16OA00PL1U0YP --paths /\*


else
  echo "** Syncing to dev s3 bucket **"
  aws s3 sync ./ s3://static.iobio.io/dev/vcf.iobio.io/
  echo "** Renew cloudfrount cache **"
  aws cloudfront create-invalidation --distribution-id E3J7METWYY0II0 --paths /\*
fi