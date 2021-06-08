-- get_repositories_by_kind returns all available repositories of a given kind
-- as a json array.
create or replace function get_repositories_by_kind(
    p_kind int,
    p_include_credentials boolean,
    p_limit int,
    p_offset int
) returns table(data json, total_count bigint) as $$
    select
        coalesce(json_agg(rJSON), '[]'),
        (select count(*) from repository where repository_kind_id = p_kind)
    from (
        select rJSON
        from repository r
        cross join get_repository_by_id(r.repository_id, p_include_credentials) as rJSON
        where r.repository_kind_id = p_kind
        order by r.name asc
        limit (case when p_limit = 0 then null else p_limit end)
        offset p_offset
    ) rs;
$$ language sql;
