export type DebtSettlement = {
  debtorId: number;
  debtorName: string;
  creditorId: number;
  creditorName: string;
  amount: number;
};

export type ParticipantBalance = {
  user_id: number;
  username: string;
  balance: number;
};

/**
 * Computes the minimal set of transactions needed to settle all debts
 * among participants (greedy settlement algorithm).
 */
export function calculateSimplifiedDebts(balances: ParticipantBalance[]): DebtSettlement[] {
  const participants = balances.map((b) => ({
    user_id: b.user_id,
    username: b.username,
    balance: b.balance,
  }));

  const debtors = participants
    .filter((p) => p.balance < -0.01)
    .sort((a, b) => a.balance - b.balance);
  const creditors = participants
    .filter((p) => p.balance > 0.01)
    .sort((a, b) => b.balance - a.balance);

  const settlements: DebtSettlement[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const debtAmount = -debtor.balance;
    const creditAmount = creditor.balance;

    const amountToSettle = Math.min(debtAmount, creditAmount);

    settlements.push({
      debtorId: debtor.user_id,
      debtorName: debtor.username,
      creditorId: creditor.user_id,
      creditorName: creditor.username,
      amount: amountToSettle,
    });

    debtor.balance += amountToSettle;
    creditor.balance -= amountToSettle;

    if (Math.abs(debtor.balance) < 0.01) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      cIdx++;
    }
  }

  return settlements;
}
