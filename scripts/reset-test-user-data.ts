import 'dotenv/config';
import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';

// Ensure the environment variable is set
if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL environment variable is not set.');
    process.exit(1);
}

// Test user details
const TEST_USER_NAME = 'Test';
const TEST_USER_UUID = 'f7a8b9c0-1e2f-3d45-6a7b-1234567890cd';

async function resetTestUserData() {
    try {
        console.log('Deleting finance_entries for test user...');
        await sql`DELETE FROM finance_entries WHERE user_id = ${TEST_USER_UUID}`;
        // Insert random finance_entries for the test user
        const categories = [
            { tipo: 'Salario', accion: 'Ingreso' },
            { tipo: 'Vivienda', accion: 'Inversión' },
            { tipo: 'Ocio', accion: 'Gasto' },
            { tipo: 'Comida', accion: 'Gasto' },
            { tipo: 'Transporte', accion: 'Gasto' },
            { tipo: 'Ahorro', accion: 'Ingreso' },
            { tipo: 'Servicios', accion: 'Gasto' },
            { tipo: 'Salud', accion: 'Gasto' },
            { tipo: 'Negocio', accion: 'Inversión' },
        ];
        const randomDetails = [
            'Pago mensual',
            'Compra supermercado',
            'Cena restaurante',
            'Suscripción online',
            'Recibo luz',
            'Recibo agua',
            'Transferencia',
            'Ingreso extra',
            'Taxi',
            'Gasolina',
        ];
        const today = new Date();
        const randomFinanceEntries = Array.from({ length: 15 }).map(() => {
            const cat = categories[Math.floor(Math.random() * categories.length)];
            const amount = parseFloat((Math.random() * (cat.accion === 'Ingreso' ? 2000 : 300) + (cat.accion === 'Ingreso' ? 500 : 10)).toFixed(2));
            const daysAgo = Math.floor(Math.random() * 60);
            const date = new Date(today);
            const plataforma_pago = ['Transferencia', 'Tarjeta', 'Efectivo', 'Domiciliación'][Math.floor(Math.random() * 4)];
            date.setDate(today.getDate() - daysAgo);
            return {
                id: uuidv4(),
                que: cat.accion === 'Ingreso' ? 'Ingreso aleatorio' : cat.accion === 'Gasto' ? 'Gasto aleatorio' : 'Inversión aleatoria',
                accion: cat.accion,
                tipo: cat.tipo,
                plataforma_pago: plataforma_pago,
                detalle1: randomDetails[Math.floor(Math.random() * randomDetails.length)],
                detalle2: randomDetails[Math.floor(Math.random() * randomDetails.length)],
                cantidad: amount,
                fecha: date.toISOString().slice(0, 10),
                user_id: TEST_USER_UUID,
            };
        });

        for (const entry of randomFinanceEntries) {
            await sql`
                INSERT INTO finance_entries (
                    id, que, accion, tipo, plataforma_pago, detalle1, detalle2, cantidad, fecha, user_id
                ) VALUES (
                    ${entry.id}, ${entry.que}, ${entry.accion}, ${entry.tipo}, ${entry.plataforma_pago},
                    ${entry.detalle1}, ${entry.detalle2}, ${entry.cantidad}, ${entry.fecha}, ${entry.user_id}
                )
                ON CONFLICT (id) DO NOTHING;
            `;
        }
        console.log(`Inserted ${randomFinanceEntries.length} random finance_entries for test user.`);

        console.log('Deleting recurring_records for test user...');
        await sql`DELETE FROM recurring_records WHERE user_id = ${TEST_USER_UUID}`;

        // Add more tables here if needed, e.g. users, etc.
        // await sql`DELETE FROM users WHERE id = ${TEST_USER_ID} OR id = ${TEST_USER_UUID}`;

        // Insert some recurring records for the test user
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
                user_id: TEST_USER_UUID,
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
                user_id: TEST_USER_UUID,
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
                user_id: TEST_USER_UUID,
            },
        ];

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
        console.log(`Inserted ${recurringRecords.length} recurring records for test user.`);
        console.log('Test user data reset complete.');
    } catch (error) {
        console.error('Error resetting test user data:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

resetTestUserData();
