output "api_gateway_url" {
  description = "The invoke URL for the API Gateway"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "lambda_function_name" {
  description = "The Lambda function name"
  value       = aws_lambda_function.mingle_server.function_name
}

output "lambda_function_arn" {
  description = "The Lambda function ARN"
  value       = aws_lambda_function.mingle_server.arn
}
