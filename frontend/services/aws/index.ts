/**
 * AWS service layer barrel.
 * Each module exports a thin interface so the rest of the app
 * never imports AWS SDKs directly — making it easy to swap
 * mock ↔ live implementations via NEXT_PUBLIC_DATA_MODE.
 */

export * from './iot'
export * from './dynamodb'
export * from './timestream'
export * from './bedrock'
export * from './location'
export * from './s3'
