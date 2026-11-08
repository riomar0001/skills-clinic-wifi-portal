"""wifi user: first/last name and UMindanao email instead of full name

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-08 08:15:40.721632

Existing full names are split at the last space ("Mario Jr Inguito" -> "Mario Jr" + "Inguito").
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None

EMAIL_UNIQUE = "uq_wifi_users_email"


def _split(full_name: str) -> tuple[str, str]:
    full_name = (full_name or "").strip()
    if " " not in full_name:
        return full_name, ""
    first, last = full_name.rsplit(" ", 1)
    return first.strip(), last.strip()


def upgrade() -> None:
    with op.batch_alter_table('wifi_users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('first_name', sa.String(length=60), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('last_name', sa.String(length=60), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('email', sa.String(length=254), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, full_name FROM wifi_users")).fetchall()
    for row_id, full_name in rows:
        first, last = _split(full_name)
        conn.execute(sa.text("UPDATE wifi_users SET first_name = :f, last_name = :l WHERE id = :id"),
                     {"f": first[:60], "l": last[:60], "id": row_id})

    with op.batch_alter_table('wifi_users', schema=None) as batch_op:
        batch_op.create_unique_constraint(EMAIL_UNIQUE, ['email'])
        batch_op.drop_column('full_name')


def downgrade() -> None:
    with op.batch_alter_table('wifi_users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('full_name', sa.String(length=80), nullable=False, server_default=''))

    op.get_bind().execute(sa.text(
        "UPDATE wifi_users SET full_name = substr(trim(first_name || ' ' || last_name), 1, 80)"))

    with op.batch_alter_table('wifi_users', schema=None) as batch_op:
        batch_op.drop_constraint(EMAIL_UNIQUE, type_='unique')
        batch_op.drop_column('email')
        batch_op.drop_column('last_name')
        batch_op.drop_column('first_name')
