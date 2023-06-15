const { MongoClient } = require('mongodb');

async function main() {
    try {
        console.log('connecting...')
        const client = await MongoClient.connect('mongodb://node1:27017')
        console.log('connected!')

        const coll = client.db('pushdb').collection('pushcoll')
        // await coll.insertOne({ title: 'history', val: [] })
        // await coll.updateOne({ title: 'history' }, {
        //     $push: { val: 3 }
        // })

        // const hist = (await coll.findOne({ title: 'history' })).val
        // console.log('current hist from my perspective: ', hist)

        const res = (await coll.aggregate([{
            $match: {
                val: 2
            }
        },
            {
                $project: {
                    val: {
                        $slice: [
                            '$val',
                            {
                                $subtract: [
                                    { $indexOfArray: ['$val', 3] },
                                    { $add: [{ $size: '$val' }, -1]},
                                ],
                            },
                        ]
                    }
                }
            }
        ]).toArray())[0]
        console.log(res)

        await client.close();

    } catch (e) {
        console.error(e)
    }
}

main().catch(console.error)


/**
 *
        console.log('starting transaction')
        const session = client.startSession()
        session.startTransaction({
            readConcern: "majority",
            writeConcern: {
                w: "majority",
                j: true
            }
        })

        const coll = client.db('incdb').collection('inccol')
        // await client.db('incdb').collection('inccol').insertOne({ title: 'The val', val: 0 })
        const data = await coll.findOne({ title: 'The val' })
        const val = data.val

        console.log('got val ', val)
        await new Promise(resolve => setTimeout(resolve, 3000))

        console.log('inserting val')
        await coll.updateOne({ title: 'The val' }, { $set: { val: val + 1 } })

        console.log('finished update')

        await session.commitTransaction()
        console.log('committed transaction')
 */
