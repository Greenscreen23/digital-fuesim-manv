import { AMQPClient } from '@cloudamqp/amqp-client'
import hash from 'object-hash'

async function main() {
    try {
        const amqp = new AMQPClient("amqp://localhost:5674")
        const conn = await amqp.connect()
        const ch = await conn.channel()
        const q1 = await ch.queue('q1', { durable: true }, { "x-queue-type": "quorum" })

        const consumer1 = await q1.subscribe({ noAck: false }, async (msg) => {
            console.log(msg.bodyToString())
        })

        await consumer1.wait()
        await conn.close()
    } catch (e) {
        console.error(e)
    }
}

main().catch(console.error)

/**
 *
 * import { AMQPClient } from '@cloudamqp/amqp-client'
import hash from 'object-hash'

async function main() {
    try {
        const amqp = new AMQPClient("amqp://localhost:5674")
        const conn = await amqp.connect()
        const ch = await conn.channel()
        const q1 = await ch.queue('q1', { durable: true }, { "x-queue-type": "quorum" })
        const q2 = await ch.queue('q2', { durable: true }, { "x-queue-type": "quorum" })
        const q3 = await ch.queue('q3', { durable: true }, { "x-queue-type": "quorum" })

        ch.exchangeDeclare('logs', 'fanout', { durable: true })
        ch.queueBind('q1', 'logs', '')
        ch.queueBind('q2', 'logs', '')
        ch.queueBind('q3', 'logs', '')

        let a1 = ''
        let a2 = ''
        let a3 = ''

        let c1 = 200;
        let c2 = 200;
        let c3 = 200;

        const consumer1 = await q1.subscribe({ noAck: true }, async (msg) => {
            a1 += msg.bodyToString()
            c1--;
            // console.log(a1)
            if (!c1) await consumer1.cancel();
        })
        const consumer2 = await q2.subscribe({ noAck: true }, async (msg) => {
            a2 += msg.bodyToString()
            c2--;
            // console.log(a2)
            if (!c2) await consumer2.cancel();
        })
        const consumer3 = await q3.subscribe({ noAck: true }, async (msg) => {
            a3 += msg.bodyToString()
            c3--;
            // console.log(a3)
            if (!c3) await consumer3.cancel();
        })

        await Promise.all([consumer1.wait(), consumer2.wait(), consumer3.wait()])

        console.log(hash(a1))
        console.log(hash(a2))
        console.log(hash(a3))
        console.log(a1)
        console.log(a2)
        console.log(a3)

        await conn.close()
    } catch (e) {
        console.error(e)
    }
}

main().catch(console.error)

 */
