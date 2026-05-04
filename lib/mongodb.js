import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'mitech'

if (!uri) {
  throw new Error('Falta MONGODB_URI en variables de entorno')
}

let clientPromise

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  clientPromise = new MongoClient(uri).connect()
}

export async function getDb() {
  const client = await clientPromise
  return client.db(dbName)
}
