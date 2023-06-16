import { AMQPClient } from '@cloudamqp/amqp-client'

async function main() {
    try {
        const amqp = new AMQPClient("amqp://localhost:5673")
        const conn = await amqp.connect()
        const ch = await conn.channel()
        const q = await ch.queue('q1', { durable: true }, { "x-queue-type": "quorum" })
        while (true) {
            q.publish('abc123')
        }

        await conn.close()
    } catch (e) {
        console.error(e)
    }
}

main().catch(console.error)
