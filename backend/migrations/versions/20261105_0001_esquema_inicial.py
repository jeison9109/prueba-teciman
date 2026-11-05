"""Esquema inicial: máquinas, personas, averías, imputaciones y numeración de averías.

Revisada a mano: Alembic no detecta secuencias en autogenerate, por eso se crean aquí.

Revision ID: 0001
Revises: 
Create Date: 2026-11-05 16:13:48.687252

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Secuencia global del sufijo AV-<año>-<n> (spec.md). Admite huecos y no se reinicia.
    op.execute(sa.schema.CreateSequence(sa.Sequence("incident_number_seq")))
    op.create_table('machines',
    sa.Column('id', sa.Integer(), sa.Identity(always=False), nullable=False),
    sa.Column('code', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('type', sa.String(length=80), nullable=False),
    sa.Column('manufacturer', sa.String(length=120), nullable=True),
    sa.Column('model', sa.String(length=120), nullable=True),
    sa.Column('serial_number', sa.String(length=80), nullable=True),
    sa.Column('location', sa.String(length=120), nullable=False),
    sa.Column('commissioning_date', sa.Date(), nullable=True),
    sa.Column('criticality', sa.Enum('alta', 'media', 'baja', name='criticality', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('admin_status', sa.Enum('operativa', 'fuera_de_servicio', 'de_baja', name='admin_status', native_enum=False, create_constraint=True, length=32), server_default='operativa', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("btrim(location) <> ''", name=op.f('ck_machines_location_not_blank')),
    sa.CheckConstraint("btrim(name) <> ''", name=op.f('ck_machines_name_not_blank')),
    sa.CheckConstraint("btrim(type) <> ''", name=op.f('ck_machines_type_not_blank')),
    sa.CheckConstraint("code <> '' AND code = upper(btrim(code))", name=op.f('ck_machines_code_normalized')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_machines')),
    sa.UniqueConstraint('code', name=op.f('uq_machines_code'))
    )
    op.create_index(op.f('ix_machines_admin_status'), 'machines', ['admin_status'], unique=False)
    op.create_index(op.f('ix_machines_location'), 'machines', ['location'], unique=False)
    op.create_index(op.f('ix_machines_type'), 'machines', ['type'], unique=False)
    op.create_table('people',
    sa.Column('id', sa.Integer(), sa.Identity(always=False), nullable=False),
    sa.Column('full_name', sa.String(length=160), nullable=False),
    sa.Column('role', sa.Enum('tecnico', 'operario', 'responsable', name='role', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('specialty', sa.Enum('mecanica', 'electrica', 'electronica', 'hidraulica', 'neumatica', name='specialty', native_enum=False, create_constraint=True, length=32), nullable=True),
    sa.Column('email', sa.String(length=254), nullable=True),
    sa.Column('phone', sa.String(length=40), nullable=True),
    sa.Column('hourly_cost', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("btrim(full_name) <> ''", name=op.f('ck_people_full_name_not_blank')),
    sa.CheckConstraint("email IS NULL OR email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'", name=op.f('ck_people_email_format')),
    sa.CheckConstraint('hourly_cost IS NULL OR hourly_cost >= 0', name=op.f('ck_people_hourly_cost_non_negative')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_people'))
    )
    op.create_index(op.f('ix_people_active'), 'people', ['active'], unique=False)
    op.create_index(op.f('ix_people_role'), 'people', ['role'], unique=False)
    op.create_table('incidents',
    sa.Column('id', sa.Integer(), sa.Identity(always=False), nullable=False),
    sa.Column('number', sa.String(length=20), nullable=False),
    sa.Column('machine_id', sa.Integer(), nullable=False),
    sa.Column('reported_by_id', sa.Integer(), nullable=False),
    sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('title', sa.String(length=160), nullable=False),
    sa.Column('symptom', sa.Text(), nullable=False),
    sa.Column('failure_type', sa.Enum('mecanico', 'electrico', 'electronico', 'hidraulico', 'neumatico', 'software', 'otro', name='failure_type', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('priority', sa.Enum('urgente', 'alta', 'media', 'baja', name='priority', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('machine_stopped', sa.Boolean(), nullable=False),
    sa.Column('assigned_technician_id', sa.Integer(), nullable=True),
    sa.Column('status', sa.Enum('abierta', 'asignada', 'en_curso', 'resuelta', 'cerrada', name='status', native_enum=False, create_constraint=True, length=32), server_default='abierta', nullable=False),
    sa.Column('root_cause', sa.Text(), nullable=True),
    sa.Column('solution', sa.Text(), nullable=True),
    sa.Column('replaced_parts', sa.Text(), nullable=True),
    sa.Column('solution_type', sa.Enum('definitiva', 'provisional', 'sustitucion', 'ajuste', name='solution_type', native_enum=False, create_constraint=True, length=32), nullable=True),
    sa.Column('preventive_recommendation', sa.Text(), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('closed_by_id', sa.Integer(), nullable=True),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("(status = 'abierta') = (assigned_technician_id IS NULL)", name=op.f('ck_incidents_assignment_matches_status')),
    sa.CheckConstraint("(status = 'cerrada') = (closed_at IS NOT NULL)", name=op.f('ck_incidents_closed_at_matches_status')),
    sa.CheckConstraint("(status IN ('resuelta', 'cerrada')) = (resolved_at IS NOT NULL)", name=op.f('ck_incidents_resolved_at_matches_status')),
    sa.CheckConstraint("btrim(symptom) <> ''", name=op.f('ck_incidents_symptom_not_blank')),
    sa.CheckConstraint("btrim(title) <> ''", name=op.f('ck_incidents_title_not_blank')),
    sa.CheckConstraint("number ~ '^AV-[0-9]{4}-[0-9]{4,}$'", name=op.f('ck_incidents_number_format')),
    sa.CheckConstraint("status NOT IN ('resuelta', 'cerrada') OR (btrim(coalesce(root_cause, '')) <> '' AND btrim(coalesce(solution, '')) <> '')", name=op.f('ck_incidents_resolution_documented')),
    sa.CheckConstraint('(closed_at IS NULL) = (closed_by_id IS NULL)', name=op.f('ck_incidents_closure_has_validator')),
    sa.CheckConstraint('closed_at IS NULL OR closed_at >= resolved_at', name=op.f('ck_incidents_closed_after_resolution')),
    sa.CheckConstraint('resolved_at IS NULL OR resolved_at >= detected_at', name=op.f('ck_incidents_resolved_after_detection')),
    sa.ForeignKeyConstraint(['assigned_technician_id'], ['people.id'], name=op.f('fk_incidents_assigned_technician_id_people'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['closed_by_id'], ['people.id'], name=op.f('fk_incidents_closed_by_id_people'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['machine_id'], ['machines.id'], name=op.f('fk_incidents_machine_id_machines'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['reported_by_id'], ['people.id'], name=op.f('fk_incidents_reported_by_id_people'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_incidents')),
    sa.UniqueConstraint('number', name=op.f('uq_incidents_number'))
    )
    op.create_index(op.f('ix_incidents_assigned_technician_id'), 'incidents', ['assigned_technician_id'], unique=False)
    op.create_index(op.f('ix_incidents_closed_by_id'), 'incidents', ['closed_by_id'], unique=False)
    op.create_index('ix_incidents_machine_id_status', 'incidents', ['machine_id', 'status'], unique=False)
    op.create_index(op.f('ix_incidents_priority'), 'incidents', ['priority'], unique=False)
    op.create_index(op.f('ix_incidents_reported_by_id'), 'incidents', ['reported_by_id'], unique=False)
    op.create_index('ix_incidents_resolved_at', 'incidents', ['resolved_at'], unique=False)
    op.create_index(op.f('ix_incidents_status'), 'incidents', ['status'], unique=False)
    op.create_table('work_logs',
    sa.Column('id', sa.Integer(), sa.Identity(always=False), nullable=False),
    sa.Column('incident_id', sa.Integer(), nullable=False),
    sa.Column('technician_id', sa.Integer(), nullable=False),
    sa.Column('work_date', sa.Date(), nullable=False),
    sa.Column('minutes', sa.Integer(), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("btrim(description) <> ''", name=op.f('ck_work_logs_description_not_blank')),
    sa.CheckConstraint('minutes > 0 AND mod(minutes, 15) = 0', name=op.f('ck_work_logs_minutes_quarter_hours')),
    sa.ForeignKeyConstraint(['incident_id'], ['incidents.id'], name=op.f('fk_work_logs_incident_id_incidents'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['technician_id'], ['people.id'], name=op.f('fk_work_logs_technician_id_people'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_work_logs'))
    )
    op.create_index(op.f('ix_work_logs_incident_id'), 'work_logs', ['incident_id'], unique=False)
    op.create_index(op.f('ix_work_logs_technician_id'), 'work_logs', ['technician_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_work_logs_technician_id'), table_name='work_logs')
    op.drop_index(op.f('ix_work_logs_incident_id'), table_name='work_logs')
    op.drop_table('work_logs')
    op.drop_index(op.f('ix_incidents_status'), table_name='incidents')
    op.drop_index('ix_incidents_resolved_at', table_name='incidents')
    op.drop_index(op.f('ix_incidents_reported_by_id'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_priority'), table_name='incidents')
    op.drop_index('ix_incidents_machine_id_status', table_name='incidents')
    op.drop_index(op.f('ix_incidents_closed_by_id'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_assigned_technician_id'), table_name='incidents')
    op.drop_table('incidents')
    op.drop_index(op.f('ix_people_role'), table_name='people')
    op.drop_index(op.f('ix_people_active'), table_name='people')
    op.drop_table('people')
    op.drop_index(op.f('ix_machines_type'), table_name='machines')
    op.drop_index(op.f('ix_machines_location'), table_name='machines')
    op.drop_index(op.f('ix_machines_admin_status'), table_name='machines')
    op.drop_table('machines')
    op.execute(sa.schema.DropSequence(sa.Sequence("incident_number_seq")))
