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
    # 1. Vérifier si le barathon est actif ou passé
    if barathon.status not in ["started", "completed", "stopped"]:
        raise HTTPException(
            status_code=400,
            detail="Les dépenses ou remboursements ne peuvent être ajoutés que sur un barathon en cours, terminé ou arrêté."
        )

    participant_ids = {p.user_id for p in barathon.participants}

    # 4. Vérifier que le payeur fait partie des participants
    if payload.payer_user_id not in participant_ids:
        raise HTTPException(
            status_code=400,
            detail="Le payeur doit faire partie des participants du barathon."
        )

    # 5. Vérifier que tous les bénéficiaires font partie des participants
    invalid_beneficiary_ids = set(payload.beneficiary_user_ids) - participant_ids
    if invalid_beneficiary_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Certains bénéficiaires ne participent pas au barathon: {sorted(list(invalid_beneficiary_ids))}"
        )

    # 6. Créer la dépense
    expense = BarathonExpense(
        barathon_id=barathon.id,
        payer_user_id=payload.payer_user_id,
        amount=payload.amount,
        description=payload.description,
        is_refund=payload.is_refund,
    )
    db.add(expense)
    db.flush() # Récupérer l'id de la dépense

    # 7. Ajouter les bénéficiaires
    for user_id in payload.beneficiary_user_ids:
        db.add(
            BarathonExpenseBeneficiary(
                expense_id=expense.id,
                user_id=user_id
            )
        )

    db.commit()

    # 8. Charger la dépense créée avec les relations requises
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
    # Charger toutes les dépenses associées au barathon
    expenses = db.scalars(
        select(BarathonExpense)
        .options(
            selectinload(BarathonExpense.payer),
            selectinload(BarathonExpense.beneficiaries)
        )
        .where(BarathonExpense.barathon_id == barathon.id)
    ).all()

    # 3. Préparer le dictionnaire des balances pour tous les participants
    balances_dict = {}
    for p in barathon.participants:
        balances_dict[p.user_id] = {
            "user_id": p.user_id,
            "username": p.user.username,
            "paid_amount": 0.0,
            "debt_amount": 0.0,
        }

    # 4. Parcourir toutes les dépenses pour calculer les soldes de chacun
    formatted_expenses = []
    for exp in expenses:
        payer_id = exp.payer_user_id
        amount = float(exp.amount)
        beneficiaries_ids = [b.user_id for b in exp.beneficiaries]
        num_beneficiaries = len(beneficiaries_ids)

        # Ajouter au total payé du payeur (s'il est toujours dans les participants)
        if payer_id in balances_dict:
            balances_dict[payer_id]["paid_amount"] += amount

        # Répartir la dette entre les bénéficiaires
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

    # 5. Formater la liste des balances finales
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

    # Trier la liste pour avoir les créanciers en premier, puis ordre alphabétique
    balances_list.sort(key=lambda x: (-x.balance, x.username))

    return {
        "expenses": formatted_expenses,
        "balances": balances_list
    }
