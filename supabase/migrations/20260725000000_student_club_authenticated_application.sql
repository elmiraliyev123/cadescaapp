-- Student Club applications are submitted by existing Cadesca accounts.
-- University recognition files are no longer collected in this flow.
alter table public.student_clubs
  alter column verification_document_url drop not null;
