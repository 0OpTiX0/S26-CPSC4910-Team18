from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from sqlalchemy import Integer, String, cast, desc, func
from sqlmodel import Session, select

from models import Market, Point_Transaction, Sponsor


def _get_sponsor_invoice_rows(
    session: Session,
    sponsor_name: Optional[str],
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    limit: int,
):
    total_points_expr = (-func.sum(cast(Point_Transaction.Points_Change, Integer))).label("total_points_billed")
    purchase_count_expr = func.count(Point_Transaction.TransactionID).label("purchase_count")
    driver_count_expr = func.count(func.distinct(Point_Transaction.Driver_User_ID)).label("driver_count")
    latest_purchase_expr = func.max(Point_Transaction.Created_At).label("latest_purchase_at")

    stmt = (
        select(  # type: ignore[arg-type]
            Point_Transaction.Sponsor_Name.label("sponsor_name"),
            total_points_expr,
            purchase_count_expr,
            driver_count_expr,
            latest_purchase_expr,
        )
        .where(cast(Point_Transaction.Reason_For_Change, String).like("%User Purchase%"))
        .group_by(Point_Transaction.Sponsor_Name)
        .order_by(desc(total_points_expr), desc(latest_purchase_expr))
        .limit(limit)
    )

    if sponsor_name is not None:
        stmt = stmt.where(func.lower(Point_Transaction.Sponsor_Name) == sponsor_name.lower())
    if start_date is not None:
        stmt = stmt.where(Point_Transaction.Created_At >= start_date)
    if end_date is not None:
        stmt = stmt.where(Point_Transaction.Created_At <= end_date)

    invoice_rows = session.exec(stmt).all()
    sponsor_names = [row.sponsor_name for row in invoice_rows if row.sponsor_name]

    point_values = {}
    if sponsor_names:
        point_value_rows = session.exec(
            select(Sponsor.Sponsor_Name, Market.Point_Value)
            .join(Market, Market.Market_Sponsor == Sponsor.Sponsor_ID)
            .where(Sponsor.Sponsor_Name.in_(sponsor_names))
        ).all()
        point_values = {
            row[0]: row[1]
            for row in point_value_rows
            if row[0] is not None and row[1] is not None
        }

    results = []
    for row in invoice_rows:
        point_value = point_values.get(row.sponsor_name)
        total_points_billed = int(row.total_points_billed or 0)
        invoice_amount_usd = None
        if point_value is not None:
            invoice_amount_usd = str(
                (Decimal(total_points_billed) * point_value).quantize(
                    Decimal("0.01"),
                    rounding=ROUND_HALF_UP,
                )
            )

        results.append(
            {
                "sponsor_name": row.sponsor_name,
                "total_points_billed": total_points_billed,
                "purchase_count": int(row.purchase_count or 0),
                "driver_count": int(row.driver_count or 0),
                "point_value": str(point_value) if point_value is not None else None,
                "invoice_amount_usd": invoice_amount_usd,
                "latest_purchase_at": row.latest_purchase_at,
            }
        )

    return results