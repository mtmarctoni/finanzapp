# FinanzApp - Personal Finance Management System

FinanzApp is a comprehensive personal finance management application built with Next.js, TypeScript, and PostgreSQL. It helps users track their income, expenses, and investments in one place with powerful analytics and reporting features.

---

## 📖 Table of Contents

1. [Features](#-features)
2. [Tech Stack](#%EF%B8%8F-tech-stack)
3. [Folder Structure](#-folder-structure)
4. [Scripts](#-scripts)
5. [Getting Started](#-getting-started)
6. [Database Schema](#-database-schema)
7. [Testing](#-testing)
8. [Deployment](#-deployment)
9. [Contributing](#-contributing)
10. [License](#-license)
11. [Why FinanzApp?](#-why-finanzapp)
12. [Acknowledgments](#-acknowledgments)

---

## 🚀 Features

- **Transaction Management**: Track income, expenses, and investments with ease.
- **Recurring Transactions**: Automate recurring financial entries like bills and salaries.
- **Analytics Dashboard**: Gain insights with interactive charts and graphs.
- **Export Capabilities**: Export data to Excel for further analysis.
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Secure Authentication**: Protect your data with NextAuth.js.
- **Search & Filter**: Quickly find transactions using advanced filtering options.

---

## 🛠️ Tech Stack

### Frontend

- Next.js 16 with App Router
- React 19
- TypeScript
- TailwindCSS
- Radix UI Components
- Chart.js / Recharts for data visualization

### Backend

- Next.js API Routes
- PostgreSQL (hosted on Vercel Postgres)
- NextAuth.js for authentication

### Development Tools

- ESLint
- Prettier
- Jest & Playwright for testing
- TailwindCSS PostCSS Plugin
- tsx for TypeScript execution

---

## 📂 Folder Structure

The project is organized as follows:

```
app/                # Next.js app directory with routes and pages
components/         # Reusable React components
config/             # Configuration files
lib/                # Utility functions and server-side logic
hooks/              # Custom React hooks
middlewares/        # Middleware functions
scripts/            # Utility scripts for database seeding and testing
__tests__/          # Unit and integration tests
public/             # Static assets (images, icons, etc.)
db/                 # Database schema and migration files
types/              # TypeScript type definitions
e2e/                # End-to-end tests with Playwright
```

---

## 📜 Scripts

The following scripts are available in `package.json`:

- `dev`: Start the development server.
- `build`: Build the application for production.
- `start`: Start the production server.
- `lint`: Run ESLint to check for code quality issues.
- `test`: Run unit tests with Jest.
- `test:watch`: Run Jest in watch mode.
- `test:e2e`: Run end-to-end tests with Playwright.
- `test:e2e:ui`: Run Playwright tests with the UI test runner.
- `seed:dev`: Seed the development database.
- `reset:test`: Reset test user data.

Run these scripts using `pnpm`, `npm`, or `yarn`:

```bash
pnpm run <script>
```

---

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

   - Create a new PostgreSQL database.
   - Run the database migrations:
     ```bash
     psql -h your_host -U your_username -d your_database -f db/schema.sql
     ```
   - Apply additional migrations if needed:
     ```bash
     psql -h your_host -U your_username -d your_database -f db/20250405_create_recurring_records.sql
     ```

5. **Run the development server**

   ```bash
   pnpm dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

---

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

---

## 🧪 Testing

Run the test suite with:

```bash
# Unit tests
pnpm test

# E2E tests
pnpm run test:e2e

# Test with UI
pnpm run test:e2e:ui
```

---

## 📦 Deployment

### Vercel (Recommended)

1. Push your code to a GitHub/GitLab/Bitbucket repository.
2. Import the project on Vercel.
3. Set up environment variables in the Vercel dashboard.
4. Deploy!

### Self-hosting

1. Build the application:
   ```bash
   pnpm build
   ```
2. Start the production server:
   ```bash
   pnpm start
   ```

---

## 🤝 Contributing

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ✨ Why FinanzApp?

FinanzApp was created to solve the need for a simple yet powerful personal finance management tool that doesn't compromise on features or user experience. Whether you're tracking daily expenses, managing recurring bills, or analyzing your spending patterns, FinanzApp provides the tools you need to stay on top of your finances.

---

## 🙏 Acknowledgments

- Built with ❤️ using Next.js and TypeScript
- UI Components powered by Radix UI and TailwindCSS
- Database powered by PostgreSQL
- Icons by Lucide

---

Made with ❤️ by mtmarctoni | [Website](https://marctonimas.com)
