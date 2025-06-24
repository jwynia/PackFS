import 'reflect-metadata';
import { Cama } from 'camadb';

async function testCamaDB() {
  console.log('Testing CamaDB...');
  
  try {
    const db = new Cama({
      path: './test-cama',
      persistenceAdapter: 'fs' as any,
      logLevel: 'debug' as any
    });

    console.log('Creating collection...');
    const collection = await db.initCollection('test', {
      columns: [
        { type: 'string', title: 'name' },
        { type: 'number', title: 'age' }
      ],
      indexes: ['name']
    });

    console.log('Inserting data...');
    await collection.insertOne({
      name: 'John',
      age: 30
    });

    console.log('Finding data...');
    const result = await collection.findMany({ name: 'John' });
    console.log('Result:', result);

    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
  }
}

testCamaDB();