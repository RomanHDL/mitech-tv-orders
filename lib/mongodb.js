import { MongoClient } from 'mongodb'

let clientPromise

function getClientPromise() {
  if (clientPromise) return clientPromise

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('Falta MONGODB_URI en variables de entorno')
  }

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    clientPromise = new MongoClient(uri).connect()
  }

  return clientPromise
}

export async function getDb() {
  const client = await getClientPromise()
  const dbName = process.env.MONGODB_DB || 'mitech'
  return client.db(dbName)
}
