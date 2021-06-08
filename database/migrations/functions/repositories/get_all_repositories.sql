-- get_all_repositories returns all available repositories as a json array.
create or replace function get_all_repositories(
    p_include_credentials boolean,
    p_limit int,
    p_offset int
) returns table(data json, total_count bigint) as $$
    select
        coalesce(json_agg(rJSON), '[]'),
        (select count(*) from repository)
    from (
        select rJSON
        from repository r
        cross join get_repository_by_id(r.repository_id, p_include_credentials) as rJSON
        order by r.name asc
        limit (case when p_limit = 0 then null else p_limit end)
        offset p_offset
    ) rs;
$$ language sql;
