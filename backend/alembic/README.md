# Database migrations

`20260713_0001` is the baseline for databases created from
`change_requests/schema.sql` plus `change_requests/stage_A3_A6_tables.sql`.

Existing database (once):

```sh
cd backend
alembic stamp 20260713_0001
alembic upgrade head
```

New schema changes must be added as revisions and applied with `alembic upgrade
head`. Do not edit the historical SQL snapshots for post-baseline changes.
