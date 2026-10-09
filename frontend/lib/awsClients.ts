/**
 * AWS SDK clients — server-side only (Next.js API routes / Server Actions).
 * Never import this from a 'use client' component.
 *
 * Credentials come from environment variables set on the server.
 * In local dev: set in .env.local
 * In production: use IAM role attached to the deployment (ECS, Lambda, EC2).
 */

import { BedrockRuntimeClient }    from '@aws-sdk/client-bedrock-runtime'
import { DynamoDBClient }           from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient }   from '@aws-sdk/lib-dynamodb'
import { IoTDataPlaneClient }       from '@aws-sdk/client-iot-data-plane'

const REGION = process.env.AWS_REGION ?? 'us-east-1'

const BASE_CFG = {
  region: REGION,
  // When running locally with explicit keys:
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      sessionToken:    process.env.AWS_SESSION_TOKEN,
    },
  }),
}

// Bedrock — for AI assistant
export const bedrockClient = new BedrockRuntimeClient(BASE_CFG)

// DynamoDB — for operational data
const dynamo = new DynamoDBClient(BASE_CFG)
export const ddb = DynamoDBDocumentClient.from(dynamo, {
  marshallOptions:   { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
})

// IoT Data Plane — for sensor publishing
export const iotClient = new IoTDataPlaneClient({
  ...BASE_CFG,
  endpoint: process.env.AWS_IOT_ENDPOINT
    ? `https://${process.env.AWS_IOT_ENDPOINT}`
    : undefined,
})

export const DDB_TABLE = process.env.DYNAMODB_TABLE ?? 'myradar-disaster-state'
export const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-sonnet-20240229-v1:0'
export const AWS_ENABLED = process.env.AWS_ENABLED === 'true'
