locals {
  server_dir  = "${path.module}/../server"
  build_dir   = "/tmp/lambda_build"
  zip_path    = "/tmp/lambda_package.zip"
  source_hash = sha256(join("", [
    filesha256("${local.server_dir}/main.py"),
    filesha256("${local.server_dir}/requirements.txt"),
    filesha256("${local.server_dir}/agent/agent.py"),
    filesha256("${local.server_dir}/helpers/extractToken.py"),
    filesha256("${local.server_dir}/model/pinecone.py"),
  ]))
}

resource "aws_s3_bucket" "lambda_deployments" {
  bucket        = "mingle-server-lambda-deployments-530743905127"
  force_destroy = true
}

resource "null_resource" "lambda_package" {
  triggers = {
    source_hash = local.source_hash
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      rm -rf ${local.build_dir} ${local.zip_path}
      mkdir -p ${local.build_dir}

      # Copy source files
      cp ${local.server_dir}/main.py ${local.build_dir}/
      cp -r ${local.server_dir}/agent ${local.build_dir}/
      cp -r ${local.server_dir}/helpers ${local.build_dir}/
      cp -r ${local.server_dir}/model ${local.build_dir}/

      # Convert requirements from UTF-16LE to UTF-8
      iconv -f UTF-16LE -t UTF-8 ${local.server_dir}/requirements.txt > ${local.build_dir}/requirements_utf8.txt

      # Install dependencies into build dir
      pip install -r ${local.build_dir}/requirements_utf8.txt -t ${local.build_dir} --quiet

      # Strip unnecessary files to fit within Lambda 250MB unzipped limit
      python3 -c "
import shutil, os, glob

build = '${local.build_dir}'

# Remove __pycache__ directories (~65MB)
for root, dirs, files in os.walk(build):
    for d in dirs:
        if d == '__pycache__':
            shutil.rmtree(os.path.join(root, d))

# Remove dist-info directories (~4MB)
for item in os.listdir(build):
    if item.endswith('.dist-info') or item.endswith('.egg-info'):
        shutil.rmtree(os.path.join(build, item))

# Remove test/tests directories (~17MB)
for root, dirs, files in os.walk(build):
    for d in dirs:
        if d in ('tests', 'test'):
            shutil.rmtree(os.path.join(root, d))

# Remove googleapiclient discovery_cache (~90MB)
dc = os.path.join(build, 'googleapiclient', 'discovery_cache')
if os.path.isdir(dc):
    shutil.rmtree(dc)
    os.makedirs(dc)
    open(os.path.join(dc, '__init__.py'), 'w').close()

# Remove .pyc files
for root, dirs, files in os.walk(build):
    for f in files:
        if f.endswith('.pyc'):
            os.remove(os.path.join(root, f))

# Strip shared libraries
import subprocess
for root, dirs, files in os.walk(build):
    for f in files:
        if f.endswith('.so'):
            fp = os.path.join(root, f)
            subprocess.run(['strip', '--strip-unneeded', fp], capture_output=True)
"

      # Create zip package using Python (zip may not be available)
      python3 -c "
import zipfile, os
build='${local.build_dir}'
with zipfile.ZipFile('${local.zip_path}', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for root, dirs, files in os.walk(build):
        for f in files:
            fp = os.path.join(root, f)
            zf.write(fp, os.path.relpath(fp, build))
"
    EOT
  }
}

resource "aws_s3_object" "lambda_zip" {
  bucket     = aws_s3_bucket.lambda_deployments.id
  key        = "lambda_package.zip"
  source     = local.zip_path
  source_hash = local.source_hash

  depends_on = [null_resource.lambda_package]
}

resource "aws_lambda_function" "mingle_server" {
  function_name = "mingle-server"
  role          = aws_iam_role.lambda_role.arn
  handler       = "main.handler"
  runtime       = "python3.11"
  memory_size   = 512
  timeout       = 120

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.lambda_zip.key

  source_code_hash = local.source_hash

  environment {
    variables = {
      GOOGLE_API_KEY       = "AIzaSyCXYZ53mmywV4WHI863kCcBO07xtm3djNA"
      TOKEN_SECRET         = "sD3kU9jR2bH7wM5cT8yGqL1eF4vZ6qP0nXoA2dS7tEw"
      ALGORITHM            = "HS256"
      PINECONE_API_KEY     = "pcsk_6tuSCs_LpKXGGnTiVAs4uXiAj1cknVK4x8X4BGGXuMPjiEYyuGECsw2JMZZtuC83UUwH51"
      PINECONE_INDEX_NAME  = "mingle"
      NEXT_PUBLIC_APP_URL  = "https://mingle-blue.vercel.app"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_s3_object.lambda_zip,
  ]
}
