import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';

// Test user ID that matches our development credentials
const TEST_USER_ID = 'test1';

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Generate test data
const generateTestData = () => {
  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  // Recurring records
  const recurringRecords = [
    {
      id: uuidv4(),
      name: 'Nómina',
      accion: 'Ingreso',
      tipo: 'Salario',
      detalle1: 'Empresa S.A.',
      detalle2: 'Nómina mensual',
      amount: 2500.00,
      frequency: 'monthly',
      active: true,
      dia: 1,
      plataforma_pago: 'Transferencia',
      user_id: TEST_USER_ID,
    },
    {
      id: uuidv4(),
      name: 'Alquiler',
      accion: 'Gasto',
      tipo: 'Vivienda',
      detalle1: 'Piso centro',
      detalle2: 'Alquiler mensual',
      amount: 800.00,
      frequency: 'monthly',
      active: true,
      dia: 5,
      plataforma_pago: 'Domiciliación',
      user_id: TEST_USER_ID,
    },
    {
      id: uuidv4(),
      name: 'Gimnasio',
      accion: 'Gasto',
      tipo: 'Ocio',
      detalle1: 'Gimnasio Premium',
      detalle2: 'Cuota mensual',
      amount: 45.90,
      frequency: 'monthly',
      active: true,
      dia: 10,
      plataforma_pago: 'Tarjeta',
      user_id: TEST_USER_ID,
    },
  ];

  // Generate finance entries for the last 3 months
  const financeEntries = [];
  const entryCategories = ['Comida', 'Transporte', 'Ocio', 'Salario', 'Inversiones'];
  const entryTypes = ['Gasto', 'Ingreso', 'Inversión'];
  const platforms = ['Efectivo', 'Tarjeta', 'Transferencia', 'Bizum'];
  
  for (let i = 0; i < 90; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const isIncome = Math.random() > 0.7;
    const isInvestment = !isIncome && Math.random() > 0.8;
    
    let type, amount;
    
    if (isIncome) {
      type = 'Ingreso';
      amount = (Math.random() * 1000 + 500).toFixed(2); // 500 - 1500
    } else if (isInvestment) {
      type = 'Inversión';
      amount = (Math.random() * 500 + 100).toFixed(2); // 100 - 600
    } else {
      type = 'Gasto';
      amount = (Math.random() * 200 + 5).toFixed(2); // 5 - 205
    }
    
    const category = isIncome 
      ? 'Salario' 
      : isInvestment 
        ? 'Inversiones' 
        : ['Comida', 'Transporte', 'Ocio'][Math.floor(Math.random() * 3)];
    
    financeEntries.push({
      id: uuidv4(),
      fecha: formatDate(date),
      tipo: type,
      accion: isIncome ? 'Ingreso' : 'Gasto',
      que: `Pago de ${category.toLowerCase()}`,
      cantidad: parseFloat(amount),
      plataforma_pago: platforms[Math.floor(Math.random() * platforms.length)],
      detalle1: `Detalle 1 para ${category}`,
      detalle2: `Detalle 2 para ${category}`,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      user_id: TEST_USER_ID,
    });
  }

  return { recurringRecords, financeEntries };
};

// Seed the database
const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');
    
    const { recurringRecords, financeEntries } = generateTestData();
    
    // Insert recurring records
    for (const record of recurringRecords) {
      await sql`
        INSERT INTO recurring_records (
          id, name, accion, tipo, detalle1, detalle2, amount, 
          frequency, active, dia, plataforma_pago, user_id
        )
        VALUES (
          ${record.id}, ${record.name}, ${record.accion}, ${record.tipo}, 
          ${record.detalle1}, ${record.detalle2}, ${record.amount}, 
          ${record.frequency}, ${record.active}, ${record.dia}, 
          ${record.plataforma_pago}, ${record.user_id}
        )
        ON CONFLICT (id) DO NOTHING;
      `;
    }
    console.log(`Inserted ${recurringRecords.length} recurring records`);
    
    // Insert finance entries
    const batchSize = 50;
    for (let i = 0; i < financeEntries.length; i += batchSize) {
      const batch = financeEntries.slice(i, i + batchSize);
      const values = batch.map(entry => 
      sql`(
        ${entry.id}, ${entry.fecha}, ${entry.tipo}, ${entry.accion}, 
        ${entry.que}, ${entry.cantidad}, ${entry.plataforma_pago}, 
        ${entry.detalle1}, ${entry.detalle2}, ${entry.created_at}, 
        ${entry.updated_at}, ${entry.user_id}
      )`
    );
    
    await sql`
      INSERT INTO finance_entries (
        id, fecha, tipo, accion, que, cantidad, plataforma_pago, 
        detalle1, detalle2, created_at, updated_at, user_id
      ) VALUES ${values.join(', ')}
      ON CONFLICT (id) DO NOTHING;
    `;
      console.log(`Inserted batch of ${Math.min(batchSize, financeEntries.length - i)} finance entries`);
    }
    
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

// Run the seed function
seedDatabase();
