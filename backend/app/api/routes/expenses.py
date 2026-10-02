from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Barathon, BarathonParticipant, BarathonExpense, BarathonExpenseBeneficiary, User
from app.api.deps.auth import get_current_user
from app.api.deps.barathons import get_barathon_with_access
from app.schemas import ExpenseCreate, BarathonExpensesReport, ExpenseRead, UserBalanceRead

router = APIRouter(prefix="/barathons/{barathon_id}/expenses", tags=["expenses"])

@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
):
    # 1. Check if the barathon is active or past
    if barathon.status not in ["started", "completed", "stopped"]:
        raise HTTPException(
            status_code=400,
            detail="Les dépenses ou remboursements ne peuvent être ajoutés que sur un barathon en cours, terminé ou arrêté."
        )

    participant_ids = {p.user_id for p in barathon.participants}

    # 4. Check that the payer is part of the participants
    if payload.payer_user_id not in participant_ids:
        raise HTTPException(
            status_code=400,
            detail="Le payeur doit faire partie des participants du barathon."
        )

    # 5. Check that all beneficiaries are part of the participants
    invalid_beneficiary_ids = set(payload.beneficiary_user_ids) - participant_ids
    if invalid_beneficiary_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Certains bénéficiaires ne participent pas au barathon: {sorted(list(invalid_beneficiary_ids))}"
        )

    # 6. Create the expense
    expense = BarathonExpense(
        barathon_id=barathon.id,
        payer_user_id=payload.payer_user_id,
        amount=payload.amount,
        description=payload.description,
        is_refund=payload.is_refund,
    )
    db.add(expense)
    db.flush() # Retrieve the expense ID

    # 7. Add beneficiaries
    for user_id in payload.beneficiary_user_ids:
        db.add(
            BarathonExpenseBeneficiary(
                expense_id=expense.id,
                user_id=user_id
            )
        )

    db.commit()

    # 8. Load the created expense with the required relationships
    created_expense = db.scalar(
        select(BarathonExpense)
        .options(
            selectinload(BarathonExpense.payer),
            selectinload(BarathonExpense.beneficiaries)
        )
        .where(BarathonExpense.id == expense.id)
    )

    return {
        "id": created_expense.id,
        "payer_user_id": created_expense.payer_user_id,
        "payer_username": created_expense.payer.username,
        "amount": float(created_expense.amount),
        "description": created_expense.description,
        "beneficiary_user_ids": [b.user_id for b in created_expense.beneficiaries],
        "created_at": created_expense.created_at,
        "is_refund": created_expense.is_refund,
    }


@router.get("", response_model=BarathonExpensesReport)
def get_expenses_and_balances(
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
):
    # Load all expenses associated with the barathon
    expenses = db.scalars(
        select(BarathonExpense)
        .options(
            selectinload(BarathonExpense.payer),
            selectinload(BarathonExpense.beneficiaries)
        )
        .where(BarathonExpense.barathon_id == barathon.id)
    ).all()

    # 3. Prepare the balances dictionary for all participants
    balances_dict = {}
    for p in barathon.participants:
        balances_dict[p.user_id] = {
            "user_id": p.user_id,
            "username": p.user.username,
            "paid_amount": 0.0,
            "debt_amount": 0.0,
        }

    # 4. Loop through all expenses to calculate balances for each
    formatted_expenses = []
    for exp in expenses:
        payer_id = exp.payer_user_id
        amount = float(exp.amount)
        beneficiaries_ids = [b.user_id for b in exp.beneficiaries]
        num_beneficiaries = len(beneficiaries_ids)

        # Add to the payer's total paid (if still in participants)
        if payer_id in balances_dict:
            balances_dict[payer_id]["paid_amount"] += amount

        # Distribute the debt among beneficiaries
        if num_beneficiaries > 0:
            share = amount / num_beneficiaries
            for b_id in beneficiaries_ids:
                if b_id in balances_dict:
                    balances_dict[b_id]["debt_amount"] += share

        formatted_expenses.append({
            "id": exp.id,
            "payer_user_id": payer_id,
            "payer_username": exp.payer.username,
            "amount": amount,
            "description": exp.description,
            "beneficiary_user_ids": beneficiaries_ids,
            "created_at": exp.created_at,
            "is_refund": exp.is_refund,
        })

    # 5. Format the list of final balances
    balances_list = []
    for u_id, bal in balances_dict.items():
        paid = bal["paid_amount"]
        debt = bal["debt_amount"]
        balances_list.append(
            UserBalanceRead(
                user_id=bal["user_id"],
                username=bal["username"],
                paid_amount=round(paid, 2),
                debt_amount=round(debt, 2),
                balance=round(paid - debt, 2)
            )
        )

    # Sort the list to have creditors first, then alphabetically
    balances_list.sort(key=lambda x: (-x.balance, x.username))

    return {
        "expenses": formatted_expenses,
        "balances": balances_list
    }
