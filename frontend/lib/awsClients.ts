/**
 * AWS SDK clients — server-side only (Next.js API routes).
 * Never import this from a 'use client' component.
 */

import { BedrockRuntimeClient }  from '@aws-sdk/client-bedrock-runtime'
import { DynamoDBClient }         from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { IoTDataPlaneClient }     from '@aws-sdk/client-iot-data-plane'
import { SNSClient }              from '@aws-sdk/client-sns'

const REGION = process.env.AWS_REGION ?? 'us-east-1'

const BASE_CFG = {
  region: REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      sessionToken:    process.env.AWS_SESSION_TOKEN || undefined,
    },
  }),
}

// Amazon Bedrock — AI assistant
export const bedrockClient = new BedrockRuntimeClient(BASE_CFG)

// Amazon DynamoDB — operational data store
const dynamo = new DynamoDBClient(BASE_CFG)
export const ddb = DynamoDBDocumentClient.from(dynamo, {
  marshallOptions:   { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
})

// AWS IoT Core Data Plane — publish sensor telemetry to MQTT topics
export const iotClient = new IoTDataPlaneClient({
  ...BASE_CFG,
  ...(process.env.AWS_IOT_ENDPOINT && {
    endpoint: `https://${process.env.AWS_IOT_ENDPOINT}`,
  }),
})

// Amazon SNS — flood alert SMS / email notifications
export const snsClient = new SNSClient(BASE_CFG)

// ── Config exports ────────────────────────────────────────────────
export const DDB_TABLE    = process.env.DYNAMODB_TABLE    ?? 'myradar-disaster'
export const BEDROCK_MODEL= process.env.BEDROCK_MODEL_ID  ?? 'amazon.nova-pro-v1:0'
export const AWS_ENABLED  = process.env.AWS_ENABLED === 'true'
export const SNS_TOPIC_ARN= process.env.SNS_TOPIC_ARN     ?? ''
export const IOT_TOPIC    = process.env.IOT_TOPIC          ?? 'myradar/sensors'
