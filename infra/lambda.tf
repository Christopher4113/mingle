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

      # Create zip package
      cd ${local.build_dir}
      zip -r9 ${local.zip_path} . -q
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
