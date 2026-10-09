/**
 * AWS IoT Core abstraction.
 *
 * In DEMO mode: returns simulated sensor telemetry.
 * In AWS mode: connects via AWS IoT Device SDK / MQTT over WSS.
 *
 * Architecture: Sensor devices → AWS IoT Core → Lambda → DynamoDB / Timestream
 *               Frontend subscribes to IoT topic for live updates.
 */

import type { Sensor } from '@/types/disaster'

const IS_DEMO = process.env.NEXT_PUBLIC_DATA_MODE !== 'aws'

export interface IoTSensorUpdate {
  sensorId: string
  reading: number
  battery: number
  timestamp: string
}

/** Subscribe to live sensor updates. Returns an unsubscribe function. */
export function subscribeToSensorUpdates(
  callback: (update: IoTSensorUpdate) => void,
): () => void {
  if (IS_DEMO) {
    // In demo mode the simulation engine drives sensor state directly;
    // this subscription is a no-op so we don't double-update.
    return () => {}
  }

  // ── AWS IoT Core (production) ──────────────────────────────────────────────
  // Replace this block with actual AWS IoT Device SDK v2 MQTT subscription.
  //
  // Example (pseudocode — requires @aws-sdk/client-iot-data-plane or mqtt.js):
  //
  // const client = new mqtt.MqttClient()
  // const connection = client.new_connection({
  //   host: process.env.NEXT_PUBLIC_IOT_ENDPOINT!,
  //   port: 443,
  //   client_id: `nexus-frontend-${Date.now()}`,
  //   use_websocket: true,
  //   clean_session: true,
  // })
  // connection.on('message', (_topic, payload) => callback(JSON.parse(payload.toString())))
  // connection.connect()
  // connection.subscribe('nexus/sensors/#')
  // return () => connection.disconnect()

  console.warn('[IoT] AWS mode not configured — falling back to demo')
  return () => {}
}

/** Publish a device update (responder status change, etc.) to IoT Core */
export async function publishDeviceUpdate(
  topic: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (IS_DEMO) return
  // In production: use AWS IoT Data Plane API or MQTT publish
  console.log('[IoT] Would publish to', topic, payload)
}

/** Mock sensor reading for a given sensor type */
export function mockSensorReading(sensor: Sensor): number {
  switch (sensor.type) {
    case 'WATER_LEVEL': return parseFloat((sensor.reading + (Math.random() * 0.04 - 0.01)).toFixed(2))
    case 'RAINFALL': return parseFloat((sensor.reading + (Math.random() * 2 - 0.5)).toFixed(1))
    case 'TEMPERATURE': return parseFloat((sensor.reading + (Math.random() * 0.2 - 0.1)).toFixed(1))
    case 'AIR_QUALITY': return Math.round(sensor.reading + (Math.random() * 4 - 1))
    default: return sensor.reading
  }
}
