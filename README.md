# FinanzApp - Personal Finance Management System

FinanzApp is a comprehensive personal finance management application built with Next.js, TypeScript, and PostgreSQL. It helps users track their income, expenses, and investments in one place with powerful analytics and reporting features.

## 🚀 Features

- **Transaction Management**: Track income, expenses, and investments
- **Recurring Transactions**: Set up and manage recurring financial entries
- **Analytics Dashboard**: Visualize your financial data with interactive charts
- **Export Capabilities**: Export your data to Excel for further analysis
- **Responsive Design**: Works on desktop and mobile devices
- **Secure Authentication**: Built-in user authentication system
- **Search & Filter**: Quickly find transactions with advanced filtering

## 🛠️ Tech Stack

- **Frontend**:
  - Next.js 14 with App Router
  - React 19
  - TypeScript
  - TailwindCSS
  - Radix UI Components
  - Chart.js / Recharts for data visualization

- **Backend**:
  - Next.js API Routes
  - PostgreSQL (hosted on Vercel Postgres)
  - NextAuth.js for authentication

- **Development Tools**:
  - ESLint
  - Prettier
  - Jest & Playwright for testing

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/finanzapp.git
   cd finanzapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory and add the following variables:
   ```env
   DATABASE_URL=your_postgres_connection_string
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Set up the database**
   - Create a new PostgreSQL database
   - Run the database migrations:
     ```bash
     psql -h your_host -U your_username -d your_database -f db/schema.sql
     ```
   - Apply additional migrations if needed:
     ```bash
     # Example for recurring records table
     psql -h your_host -U your_username -d your_database -f db/20250405_create_recurring_records.sql
     ```

5. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## 📊 Database Schema

The application uses the following main tables:

### `finance_entries`
- `id` - Unique identifier (UUID)
- `fecha` - Transaction date
- `tipo` - Transaction type (e.g., Food, Bills, Salary)
- `accion` - Action (Income, Expense, Investment)
- `que` - Description of the transaction
- `plataforma_pago` - Payment method/platform
- `cantidad` - Amount
- `detalle1`, `detalle2` - Additional details
- `created_at`, `updated_at` - Timestamps

### `recurring_records`
- `id` - Unique identifier (UUID)
- `name` - Record name
- `accion` - Action type
- `tipo` - Category
- `frequency` - Recurrence frequency (daily, weekly, monthly, yearly)
- `amount` - Transaction amount
- `active` - Whether the record is active
- `dia` - Day of month for monthly transactions
- `plataforma_pago` - Payment platform
- `detalle1`, `detalle2` - Additional details

## 🧪 Testing

Run the test suite with:

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test with UI
npm run test:e2e:ui
```

## 📦 Deployment

### Vercel (Recommended)

1. Push your code to a GitHub/GitLab/Bitbucket repository
2. Import the project on Vercel
3. Set up environment variables in the Vercel dashboard
4. Deploy!

### Self-hosting
1. Build the application:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm start
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ✨ Why FinanzApp?

FinanzApp was created to solve the need for a simple yet powerful personal finance management tool that doesn't compromise on features or user experience. Whether you're tracking daily expenses, managing recurring bills, or analyzing your spending patterns, FinanzApp provides the tools you need to stay on top of your finances.

## 🙏 Acknowledgments

- Built with ❤️ using Next.js and TypeScript
- UI Components powered by Radix UI and TailwindCSS
- Database powered by PostgreSQL
- Icons by Lucide

---

Made with ❤️ by mtmarctoni | [Website](https://marctonimas.com)
