import { render, screen, fireEvent } from "@testing-library/react";
import { CryptoTransactionForm } from "@/components/crypto/crypto-transaction-form";

describe("CryptoTransactionForm", () => {
  it("renders the price field for Genesis transactions", () => {
    render(<CryptoTransactionForm />);

    // Select Genesis transaction type
    const transactionTypeSelect = screen.getByLabelText(/tipo de transacción/i);
    fireEvent.change(transactionTypeSelect, { target: { value: "genesis" } });

    // Check if the price field is displayed
    const priceField = screen.getByLabelText(/precio promedio/i);
    expect(priceField).toBeInTheDocument();
  });

  it("does not render the price field for non-Genesis transactions", () => {
    render(<CryptoTransactionForm />);

    // Select Deposit transaction type
    const transactionTypeSelect = screen.getByLabelText(/tipo de transacción/i);
    fireEvent.change(transactionTypeSelect, { target: { value: "deposit" } });

    // Check if the price field is not displayed
    const priceField = screen.queryByLabelText(/precio promedio/i);
    expect(priceField).not.toBeInTheDocument();
  });
});