create schema if not exists core;

create or replace function core.normalize_size(input text)
returns text
language sql
immutable
as $$
select
  regexp_replace(
    regexp_replace(
      regexp_replace(
        upper(coalesce(input, '')),
        '\s+', ' ', 'g'
      ),
      '\s*([\-\/\.,])\s*', '\1', 'g'
    ),
    '\s+', '', 'g'
  );
$$;
